import type { CreateQuizDto, ReviewerGenerationJob } from '@quiz-creator/types';
import type { IQuizRepository } from '../repositories/IQuizRepository';
import type { ReviewerGenerationRepository } from '../repositories/IReviewerGenerationRepository';
import { PdfReviewerParserService } from './PdfReviewerParserService';
import { ReviewerItemGeneratorService } from './ReviewerItemGeneratorService';
import { ReviewerItemValidationService, type ValidatedReviewerItem } from './ReviewerItemValidationService';

export interface ReviewerGenerationProcessResult {
  jobId: string;
  reviewerSetId: string;
  quizId: string;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Reviewer generation failed';
  return message.replace(/\s+/g, ' ').slice(0, 500);
}

const MAX_PROVIDER_ATTEMPTS = 3;

function isRetryableProviderError(error: unknown): boolean {
  const message = safeErrorMessage(error).toLowerCase();
  return /openrouter request failed with status (408|409|425|429|5\d\d)|timed out|network|fetch failed|rate limit|overloaded|temporarily unavailable/.test(message);
}

function quizQuestion(item: ValidatedReviewerItem, orderIndex: number): CreateQuizDto['questions'][number] {
  const options = item.questionType === 'short_answer' ? [] : item.options;
  const answerIndex = item.questionType === 'true_false'
    ? item.answer.toLowerCase() === 'true' ? 0 : 1
    : Math.max(0, options.findIndex((option) => option.toLowerCase() === item.answer.toLowerCase()));
  return {
    question_text: item.question,
    answer_text: item.answer,
    question_type: item.questionType === 'short_answer' ? 'typed_answer' : 'multiple_choice',
    options,
    correct_answer: answerIndex,
    explanation: item.explanation || null,
    source_pages: Array.from({ length: item.sourcePageEnd - item.sourcePageStart + 1 }, (_, index) => item.sourcePageStart + index),
    order_index: orderIndex
  };
}

export class ReviewerGenerationService {
  constructor(
    private readonly reviewerRepository: ReviewerGenerationRepository,
    private readonly quizRepository: IQuizRepository,
    private readonly parser = new PdfReviewerParserService(),
    private readonly generator = new ReviewerItemGeneratorService(),
    private readonly validator = new ReviewerItemValidationService()
  ) {}

  async processJob(jobId: string): Promise<ReviewerGenerationProcessResult | null> {
    const claimed = await this.reviewerRepository.claimJob(jobId);
    if (!claimed) {
      const current = await this.reviewerRepository.getJob(jobId);
      if (current?.status === 'published' && current.quizId) {
        return { jobId: current.id, reviewerSetId: current.reviewerSetId, quizId: current.quizId };
      }
      return null;
    }
    return this.processClaimedJob(claimed);
  }

  async processNextJob(): Promise<ReviewerGenerationProcessResult | null> {
    const claimed = await this.reviewerRepository.claimNextJob();
    return claimed ? this.processClaimedJob(claimed) : null;
  }

  private async processClaimedJob(job: ReviewerGenerationJob): Promise<ReviewerGenerationProcessResult> {
    let parsingStarted = false;
    let createdQuizId: string | null = null;
    let published = false;
    try {
      const existingSet = await this.reviewerRepository.getReviewerSet?.(job.reviewerSetId);
      if (existingSet?.status === 'available' && existingSet.quizId) {
        await this.reviewerRepository.updateJob(job.id, {
          status: 'published', progressPercent: 100, message: 'Reviewer set published', quizId: existingSet.quizId
        });
        return { jobId: job.id, reviewerSetId: job.reviewerSetId, quizId: existingSet.quizId };
      }

      const document = await this.reviewerRepository.getSourceDocument(job.documentId, job.requestedBy);
      if (!document) throw new Error('Source document not found or access is restricted');

      let source = await this.reviewerRepository.getStoredSourceContent(document.id);
      if (document.parseStatus !== 'parsed' || source.pages.length === 0 || source.chunks.length === 0) {
        parsingStarted = true;
        await this.reviewerRepository.updateJob(job.id, {
          status: 'parsing', stage: 'parsing', progressPercent: 5, message: 'Parsing PDF source'
        });
        source = await this.parser.parse(document);
        await this.reviewerRepository.saveParsedContent(document.id, source.pages, source.chunks);
        parsingStarted = false;
      }

      await this.reviewerRepository.updateJob(job.id, {
        status: 'parsed', stage: 'chunking', progressPercent: 30,
        message: `Parsed ${source.pages.length} pages and prepared ${source.chunks.length} source chunks`
      });
      await this.reviewerRepository.updateJob(job.id, {
        status: 'chunking', stage: 'chunking', progressPercent: 35, message: 'Preparing section-aware source chunks'
      });

      const generated = await this.generator.generate({
        documentFilename: document.originalFilename,
        pages: source.pages,
        chunks: source.chunks,
        options: job.options,
        onProgress: async ({ completedChunks, totalChunks, model }) => {
          const progress = Math.min(78, 40 + Math.round((completedChunks / Math.max(1, totalChunks)) * 38));
          await this.reviewerRepository.updateJob(job.id, {
            status: 'generating', stage: 'generating', progressPercent: progress,
            message: `Generated source-grounded candidates (${completedChunks}/${totalChunks} chunks, ${model})`
          });
        }
      });

      await this.reviewerRepository.updateJob(job.id, {
        status: 'validating', stage: 'validating', progressPercent: 82,
        message: 'Validating evidence, citations, schema, and duplicates'
      });
      const items = this.validator.validate(generated, source.pages, job.options);
      await this.reviewerRepository.updateJob(job.id, {
        status: 'validating', stage: 'publishing', progressPercent: 92,
        message: `Publishing ${items.length} validated reviewer items`
      });

      const quizInput = {
        title: job.options.title || `${document.originalFilename.replace(/\.pdf$/i, '')} Reviewer`,
        subjectId: job.options.subjectId || null,
        handoutName: document.originalFilename,
        sourceModel: process.env.OPENROUTER_API_KEY ? 'openrouter/reviewer-router' : 'local/deterministic-reviewer',
        questions: items.map(quizQuestion)
      };

      if (quizInput.subjectId) {
        const subjectAccess = await this.quizRepository.getSubjectAccess(quizInput.subjectId, job.requestedBy);
        if (!subjectAccess?.can_edit_reviewers) {
          throw new Error('Subject not found or access is restricted');
        }
      }

      // Neon performs reviewer-item insertion, quiz/question insertion, and both
      // publication state transitions in one SQL statement. This prevents a
      // visible quiz or reviewer set from escaping if any publication step fails.
      if (this.reviewerRepository.publishReviewerSetWithQuiz) {
        const publication = await this.reviewerRepository.publishReviewerSetWithQuiz({
          jobId: job.id,
          reviewerSetId: job.reviewerSetId,
          ownerId: job.requestedBy,
          quiz: quizInput,
          items
        });
        if (!publication || publication.reviewerSet.status !== 'available' || !publication.reviewerSet.quizId) {
          const recoveredSet = await this.reviewerRepository.getReviewerSet?.(job.reviewerSetId);
          if (recoveredSet?.status === 'available' && recoveredSet.quizId) {
            createdQuizId = recoveredSet.quizId;
            published = true;
            await this.reviewerRepository.updateJob(job.id, {
              status: 'published', progressPercent: 100, message: 'Reviewer set published', quizId: recoveredSet.quizId
            });
            return { jobId: job.id, reviewerSetId: job.reviewerSetId, quizId: recoveredSet.quizId };
          }
          throw new Error('Reviewer publication did not complete atomically');
        }
        published = true;
        createdQuizId = publication.quizId;
        return { jobId: job.id, reviewerSetId: job.reviewerSetId, quizId: publication.quizId };
      }

      // The in-memory adapter has no shared database transaction. Keep its
      // publication hidden behind the reviewer-set state and clean up an
      // orphaned quiz if a later step fails.
      await this.reviewerRepository.saveReviewerItems(job.reviewerSetId, items);
      const quiz = await this.quizRepository.createQuiz({
        title: quizInput.title,
        subject_id: quizInput.subjectId,
        handout_name: quizInput.handoutName,
        source_model: quizInput.sourceModel,
        questions: quizInput.questions
      }, job.requestedBy);
      createdQuizId = quiz.id;

      const publishedSet = await this.reviewerRepository.publishReviewerSet(job.reviewerSetId, quiz.id);
      if (!publishedSet || publishedSet.status !== 'available' || publishedSet.quizId !== quiz.id) {
        throw new Error('Reviewer set publication could not be verified');
      }
      published = true;
      await this.reviewerRepository.updateJob(job.id, {
        status: 'published', progressPercent: 100, message: 'Reviewer set published', quizId: quiz.id
      });
      return { jobId: job.id, reviewerSetId: job.reviewerSetId, quizId: quiz.id };
    } catch (error) {
      if (!published && isRetryableProviderError(error) && job.attemptCount < MAX_PROVIDER_ATTEMPTS) {
        const retryDelayMs = Math.min(5 * 60_000, 5_000 * (2 ** Math.max(0, job.attemptCount - 1)));
        const nextAttemptAt = new Date(Date.now() + retryDelayMs).toISOString();
        await this.reviewerRepository.updateJob(job.id, {
          status: 'queued',
          stage: job.stage || 'generating',
          message: `Provider capacity issue; retry ${job.attemptCount + 1} of ${MAX_PROVIDER_ATTEMPTS} scheduled`,
          errorCode: 'REVIEWER_PROVIDER_RETRY',
          errorMessage: safeErrorMessage(error),
          nextAttemptAt
        }).catch(() => undefined);
        throw error;
      }
      if (published) {
        // Publication already committed (or was committed before a status
        // heartbeat failed). Never turn an available reviewer set into failed.
        await this.reviewerRepository.updateJob(job.id, {
          status: 'published', progressPercent: 100, message: 'Reviewer set published', quizId: createdQuizId
        }).catch(() => undefined);
        throw error;
      }
      if (createdQuizId) {
        await this.quizRepository.deleteQuiz(createdQuizId, job.requestedBy).catch(() => undefined);
      }
      if (parsingStarted) {
        await this.reviewerRepository.markSourceDocumentParseFailed(job.documentId).catch(() => undefined);
      }
      await this.reviewerRepository.markReviewerSetFailed(job.reviewerSetId).catch(() => undefined);
      await this.reviewerRepository.updateJob(job.id, {
        status: 'failed', stage: null, progressPercent: 0,
        message: 'Reviewer generation failed',
        errorCode: 'REVIEWER_GENERATION_FAILED',
        errorMessage: safeErrorMessage(error)
      }).catch(() => undefined);
      throw error;
    }
  }
}

import { IQuizRepository, QuizGenerationService, PdfExtractionService, UserAuthoringProfileService } from '@quiz-creator/core';
import { GenerateQuizRequestDto, QuizGenerationProgressDto } from '@quiz-creator/types';

export class QuizGenerationController {
  constructor(
    private quizRepo: IQuizRepository,
    private genService: QuizGenerationService = new QuizGenerationService()
  ) {}

  async handleStreamingGeneration(
    dto: GenerateQuizRequestDto,
    sendProgress: (data: QuizGenerationProgressDto) => void,
    userId?: string
  ): Promise<{ quizId: string }> {
    sendProgress({
      progress: 5,
      message: 'Initializing',
      detail: 'Validating source material...',
      stage: 'extracting',
      pipelineMode: dto.pipelineMode || 'auto'
    });

    let pages = dto.pdfPages || [];
    if (pages.length === 0 && dto.text) {
      pages = PdfExtractionService.extractTextFromMockOrPlain(dto.text);
    }

    if (pages.length === 0) {
      sendProgress({
        progress: 0,
        message: 'Error',
        detail: 'No text or PDF pages provided for quiz generation.',
        stage: 'error'
      });
      throw new Error('No content provided');
    }

    // Adaptive profiling: learn from user's manual or adjusted reviewer history
    const authoringProfile = dto.authoringProfile || await UserAuthoringProfileService.buildProfile(this.quizRepo, userId);

    const uniqueChapters = Array.from(
      new Set(pages.map((p) => p.chapterTitle).filter((c): c is string => Boolean(c && c.trim())))
    );

    const chapterDetail = uniqueChapters.length > 1
      ? `Extracted ${pages.length} pages across ${uniqueChapters.length} chapters (${uniqueChapters.join(', ')})`
      : `Extracted ${pages.length} pages of source text`;

    sendProgress({
      progress: 25,
      message: 'Processing Material',
      detail: `${chapterDetail} (Target: ${authoringProfile.targetCount} questions adapted to your style)`,
      stage: 'extracting',
      authoringProfile,
      pipelineMode: dto.pipelineMode || 'auto'
    });

    let liveTokens = 0;
    const generated = await this.genService.generateQuiz({
      handoutPages: pages,
      pageStart: dto.pageStart,
      pageEnd: dto.pageEnd,
      pipelineMode: dto.pipelineMode || 'auto',
      authoringProfile,
      apiKey: dto.apiKey,
      groqApiKey: dto.groqApiKey,
      onStageChange: (stage, detail, model) => {
        const progressMap = {
          extracting: 40,
          reviewing: 75,
          fallback: 60,
          complete: 95
        };
        const pipeline = dto.pipelineMode || 'auto';
        const isSingleStage = pipeline === 'groq_direct' || pipeline === 'gemini_direct';
        const isVerbatim = pipeline === 'verbatim_exact';
        let message = pipeline === 'two_stage' ? 'Stage 1/2: Extracting Concepts' : 'Drafting High-Yield Questions';
        if (isSingleStage) {
          message = stage === 'complete' ? 'Complete' : 'Generating Questions';
        } else if (isVerbatim) {
          if (stage === 'extracting') {
            message = 'Stage 1/2: Extracting Verbatim Terms';
          } else if (stage === 'reviewing') {
            message = 'Stage 2/2: Validating Quotes & Assembling Distractors';
          } else if (stage === 'complete') {
            message = 'Complete';
          }
        } else if (stage === 'reviewing') {
          message = pipeline === 'two_stage' ? 'Stage 2/2: Reviewing Pedagogy' : 'Polishing Distractors & Hardening Pedagogy';
        } else if (stage === 'fallback') {
          message = pipeline === 'two_stage' ? 'Fallback: Generating Questions' : 'Adapting Strategy & Generating Questions';
        }
        sendProgress({
          progress: progressMap[stage] || 50,
          message,
          detail,
          stage,
          modelUsed: model,
          pipelineMode: pipeline
        });
      },
      onChunk: (chunk) => {
        liveTokens += Math.ceil(chunk.length / 4);
        sendProgress({
          progress: Math.min(90, 45 + Math.floor(liveTokens / 30)),
          message: 'Drafting & Polishing questions',
          detail: `Streaming output (${liveTokens} tokens)...`,
          tokensCount: liveTokens,
          pipelineMode: dto.pipelineMode || 'auto'
        });
      }
    });

    sendProgress({
      progress: 95,
      message: 'Saving Quiz',
      detail: `Saving ${generated.questions.length} questions to library...`,
      stage: 'complete',
      pipelineMode: dto.pipelineMode || 'auto'
    });

    const defaultTitle = uniqueChapters.length > 1
      ? `${uniqueChapters.length} Chapters Comprehensive Review`
      : (uniqueChapters[0] || 'Generated Handout Quiz');

    const title = dto.title || dto.handoutName || defaultTitle;
    const handoutName = dto.handoutName || (uniqueChapters.length > 0 ? uniqueChapters.join(', ') : null);

    const createdQuiz = await this.quizRepo.createQuiz({
      title,
      subject_id: dto.subjectId || null,
      handout_name: handoutName,
      source_model: generated.sourceModel,
      questions: generated.questions.map((q, idx) => ({
        question_text: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        correct_explanation: q.correct_explanation || null,
        distractor_explanations: q.distractor_explanations || null,
        discriminatory_keywords: q.discriminatory_keywords || null,
        source_pages: q.source_pages || [],
        order_index: idx
      }))
    }, userId);

    sendProgress({
      progress: 100,
      message: 'Complete',
      detail: `Quiz ready! (${generated.questions.length} questions, adapted to your style)`,
      quizId: createdQuiz.id,
      stage: 'complete',
      modelUsed: generated.sourceModel,
      pipelineMode: dto.pipelineMode || 'auto',
      authoringProfile
    });

    return { quizId: createdQuiz.id };
  }
}

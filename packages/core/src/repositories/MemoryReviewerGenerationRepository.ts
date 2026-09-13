import { randomUUID } from 'node:crypto';
import type {
  CreateReviewerGenerationJobInput,
  CreateSourceDocumentInput,
  GeneratedReviewerItem,
  ParsedPage,
  ReviewerGenerationJob,
  ReviewerSet,
  SourceChunk,
  SourceDocument
} from '@quiz-creator/types';
import type { ReviewerGenerationRepository, StoredSourceContent } from './IReviewerGenerationRepository';

function now(): string {
  return new Date().toISOString();
}

export class MemoryReviewerGenerationRepository implements ReviewerGenerationRepository {
  private readonly documents = new Map<string, SourceDocument>();
  private readonly content = new Map<string, StoredSourceContent>();
  private readonly jobs = new Map<string, ReviewerGenerationJob>();
  private readonly sets = new Map<string, ReviewerSet>();
  private readonly items = new Map<string, GeneratedReviewerItem[]>();

  async createSourceDocument(input: CreateSourceDocumentInput): Promise<SourceDocument> {
    const existing = Array.from(this.documents.values()).find(
      (document) => document.ownerId === input.ownerId && document.contentHash === input.contentHash
    );
    if (existing) return existing;
    const document: SourceDocument = {
      id: randomUUID(),
      ownerId: input.ownerId,
      originalFilename: input.originalFilename,
      storagePath: `memory://source-documents/${input.contentHash}`,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      contentHash: input.contentHash,
      pageCount: null,
      parseStatus: 'pending',
      pdfDataBase64: input.pdfDataBase64,
      createdAt: now(),
      parsedAt: null
    };
    this.documents.set(document.id, document);
    return document;
  }

  async getSourceDocument(documentId: string, ownerId?: string): Promise<SourceDocument | null> {
    const document = this.documents.get(documentId);
    return document && (!ownerId || document.ownerId === ownerId) ? document : null;
  }

  async saveParsedContent(documentId: string, pages: ParsedPage[], chunks: SourceChunk[]): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) throw new Error('Source document not found');
    document.pageCount = pages.length;
    document.parseStatus = 'parsed';
    document.parsedAt = now();
    this.content.set(documentId, { pages, chunks });
  }

  async markSourceDocumentParseFailed(documentId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (document) document.parseStatus = 'failed';
  }

  async getStoredSourceContent(documentId: string): Promise<StoredSourceContent> {
    return this.content.get(documentId) || { pages: [], chunks: [] };
  }

  async getReviewerSet(reviewerSetId: string): Promise<ReviewerSet | null> {
    return this.sets.get(reviewerSetId) || null;
  }

  async findActiveJob(documentId: string, requestedBy: string): Promise<ReviewerGenerationJob | null> {
    return Array.from(this.jobs.values()).find(
      (job) => job.documentId === documentId && job.requestedBy === requestedBy && !['published', 'failed'].includes(job.status)
    ) || null;
  }

  async findJobByIdempotencyKey(requestedBy: string, idempotencyKey: string): Promise<ReviewerGenerationJob | null> {
    return Array.from(this.jobs.values()).find(
      (job) => job.requestedBy === requestedBy && job.options.idempotencyKey === idempotencyKey
    ) || null;
  }

  async createGenerationJob(input: CreateReviewerGenerationJobInput): Promise<ReviewerGenerationJob> {
    if (input.options.idempotencyKey) {
      const existing = await this.findJobByIdempotencyKey(input.requestedBy, input.options.idempotencyKey);
      if (existing) return existing;
    }
    const set: ReviewerSet = {
      id: randomUUID(),
      ownerId: input.requestedBy,
      sourceDocumentId: input.documentId,
      title: input.options.title || 'Generated Handout Reviewer',
      generationOptions: input.options,
      status: 'generating',
      quizId: null,
      createdAt: now(),
      publishedAt: null
    };
    const job: ReviewerGenerationJob = {
      id: randomUUID(),
      documentId: input.documentId,
      reviewerSetId: set.id,
      requestedBy: input.requestedBy,
      options: input.options,
      status: 'queued',
      stage: 'parsing',
      progressPercent: 0,
      message: 'Queued for generation',
      errorCode: null,
      errorMessage: null,
      attemptCount: 0,
      createdAt: now(),
      startedAt: null,
      completedAt: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      quizId: null
    };
    this.sets.set(set.id, set);
    this.jobs.set(job.id, job);
    return job;
  }

  async getJob(jobId: string, requestedBy?: string): Promise<ReviewerGenerationJob | null> {
    const job = this.jobs.get(jobId);
    return job && (!requestedBy || job.requestedBy === requestedBy) ? job : null;
  }

  async claimJob(jobId: string): Promise<ReviewerGenerationJob | null> {
    const job = this.jobs.get(jobId);
    if (!job || ['published', 'failed'].includes(job.status)) return null;
    if (job.status === 'queued' && job.nextAttemptAt && Date.parse(job.nextAttemptAt) > Date.now()) return null;
    if (job.status !== 'queued' && job.leaseExpiresAt && Date.parse(job.leaseExpiresAt) > Date.now()) return null;
    job.status = 'parsing';
    job.stage = 'parsing';
    job.attemptCount += 1;
    job.startedAt ||= now();
    job.leaseExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    job.nextAttemptAt = null;
    return job;
  }

  async claimNextJob(): Promise<ReviewerGenerationJob | null> {
    const candidates = Array.from(this.jobs.values())
      .filter((job) => (job.status === 'queued' && (!job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= Date.now())) || (!['published', 'failed'].includes(job.status) && !!job.leaseExpiresAt && Date.parse(job.leaseExpiresAt) <= Date.now()))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return candidates.length > 0 ? this.claimJob(candidates[0].id) : null;
  }

  async updateJob(jobId: string, update: Partial<Pick<ReviewerGenerationJob, 'status' | 'stage' | 'progressPercent' | 'message' | 'errorCode' | 'errorMessage' | 'quizId' | 'nextAttemptAt'>>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    Object.assign(job, update);
    if (update.status === 'published') {
      job.completedAt = now();
      job.leaseExpiresAt = null;
      job.nextAttemptAt = null;
    } else if (update.status === 'failed') {
      job.leaseExpiresAt = null;
      job.nextAttemptAt = null;
    } else if (update.status === 'queued') {
      job.leaseExpiresAt = null;
      job.nextAttemptAt = update.nextAttemptAt || null;
    } else {
      job.leaseExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      job.nextAttemptAt = null;
    }
  }

  async saveReviewerItems(reviewerSetId: string, items: GeneratedReviewerItem[]): Promise<void> {
    this.items.set(reviewerSetId, items);
  }

  async publishReviewerSet(reviewerSetId: string, quizId: string): Promise<ReviewerSet | null> {
    const set = this.sets.get(reviewerSetId);
    if (!set) return null;
    set.status = 'available';
    set.quizId = quizId;
    set.publishedAt = now();
    return set;
  }

  async markReviewerSetFailed(reviewerSetId: string): Promise<void> {
    const set = this.sets.get(reviewerSetId);
    if (set) set.status = 'failed';
  }
}

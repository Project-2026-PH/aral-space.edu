import type {
  CreateReviewerGenerationJobInput,
  CreateSourceDocumentInput,
  CreateQuizDto,
  GeneratedReviewerItem,
  ParsedPage,
  ReviewerGenerationJob,
  ReviewerSet,
  SourceChunk,
  SourceDocument
} from '@quiz-creator/types';

export interface StoredSourceContent {
  pages: ParsedPage[];
  chunks: SourceChunk[];
}

export interface ReviewerPublicationInput {
  jobId: string;
  reviewerSetId: string;
  ownerId: string;
  quiz: {
    title: string;
    subjectId?: string | null;
    handoutName: string;
    sourceModel: string;
    questions: CreateQuizDto['questions'];
  };
  items: GeneratedReviewerItem[];
}

export interface ReviewerPublicationResult {
  reviewerSet: ReviewerSet;
  quizId: string;
}

export interface ReviewerGenerationRepository {
  createSourceDocument(input: CreateSourceDocumentInput): Promise<SourceDocument>;
  getSourceDocument(documentId: string, ownerId?: string): Promise<SourceDocument | null>;
  saveParsedContent(documentId: string, pages: ParsedPage[], chunks: SourceChunk[]): Promise<void>;
  markSourceDocumentParseFailed(documentId: string): Promise<void>;
  getStoredSourceContent(documentId: string): Promise<StoredSourceContent>;
  getReviewerSet?(reviewerSetId: string): Promise<ReviewerSet | null>;

  findActiveJob(documentId: string, requestedBy: string): Promise<ReviewerGenerationJob | null>;
  findJobByIdempotencyKey(requestedBy: string, idempotencyKey: string): Promise<ReviewerGenerationJob | null>;
  createGenerationJob(input: CreateReviewerGenerationJobInput): Promise<ReviewerGenerationJob>;
  getJob(jobId: string, requestedBy?: string): Promise<ReviewerGenerationJob | null>;
  claimJob(jobId: string): Promise<ReviewerGenerationJob | null>;
  claimNextJob(): Promise<ReviewerGenerationJob | null>;
  updateJob(
    jobId: string,
    update: Partial<Pick<ReviewerGenerationJob, 'status' | 'stage' | 'progressPercent' | 'message' | 'errorCode' | 'errorMessage' | 'quizId' | 'nextAttemptAt'>>
  ): Promise<void>;

  saveReviewerItems(reviewerSetId: string, items: GeneratedReviewerItem[]): Promise<void>;
  publishReviewerSetWithQuiz?(input: ReviewerPublicationInput): Promise<ReviewerPublicationResult | null>;
  publishReviewerSet(reviewerSetId: string, quizId: string): Promise<ReviewerSet | null>;
  markReviewerSetFailed(reviewerSetId: string): Promise<void>;
}

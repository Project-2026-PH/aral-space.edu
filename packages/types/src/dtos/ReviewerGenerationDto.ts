export type SourceDocumentParseStatus = 'pending' | 'parsing' | 'parsed' | 'failed';

export type ReviewerGenerationJobStatus =
  | 'queued'
  | 'parsing'
  | 'parsed'
  | 'chunking'
  | 'generating'
  | 'validating'
  | 'published'
  | 'failed';

export type ReviewerGenerationStage =
  | 'parsing'
  | 'chunking'
  | 'generating'
  | 'validating'
  | 'publishing';

export type ReviewerQuestionType = 'multiple_choice' | 'short_answer' | 'true_false';
export type ReviewerDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type ReviewerSetStatus = 'generating' | 'available' | 'failed';

export interface ReviewerGenerationOptions {
  title?: string;
  questionTypes: ReviewerQuestionType[];
  difficulty: ReviewerDifficulty;
  questionCount: number;
  subjectId?: string;
  idempotencyKey?: string;
}

export interface ParsedPage {
  pageNumber: number;
  text: string;
  headings: string[];
  tables?: unknown[];
  imageReferences?: string[];
  extractionMethod: 'text' | 'ocr' | 'multimodal';
  parserVersion: string;
  sourceDocumentHash: string;
  contentHash: string;
}

export interface SourceChunk {
  chunkId: string;
  documentId: string;
  sectionTitle?: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  contentHash: string;
  tokenCount: number;
}

export interface GeneratedReviewerItem {
  questionType: ReviewerQuestionType;
  question: string;
  answer: string;
  explanation?: string;
  options?: string[];
  difficulty: Exclude<ReviewerDifficulty, 'mixed'>;
  sourcePageStart: number;
  sourcePageEnd: number;
  evidenceExcerpt: string;
}

export interface SourceDocument {
  id: string;
  ownerId: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  contentHash: string;
  pageCount: number | null;
  parseStatus: SourceDocumentParseStatus;
  pdfDataBase64: string;
  createdAt: string;
  parsedAt?: string | null;
}

export interface ReviewerGenerationJob {
  id: string;
  documentId: string;
  reviewerSetId: string;
  requestedBy: string;
  options: ReviewerGenerationOptions;
  status: ReviewerGenerationJobStatus;
  stage?: ReviewerGenerationStage | null;
  progressPercent: number;
  message?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  leaseExpiresAt?: string | null;
  nextAttemptAt?: string | null;
  quizId?: string | null;
}

export interface ReviewerSet {
  id: string;
  ownerId: string;
  sourceDocumentId: string;
  title: string;
  generationOptions: ReviewerGenerationOptions;
  status: ReviewerSetStatus;
  quizId?: string | null;
  createdAt: string;
  publishedAt?: string | null;
}

export interface CreateSourceDocumentInput {
  ownerId: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  contentHash: string;
  pdfDataBase64: string;
}

export interface CreateReviewerGenerationJobInput {
  documentId: string;
  requestedBy: string;
  options: ReviewerGenerationOptions;
}

export interface ReviewerGenerationStatusResponse {
  jobId: string;
  reviewerSetId: string;
  status: ReviewerGenerationJobStatus;
  stage?: ReviewerGenerationStage | null;
  progressPercent: number;
  message?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  quizId?: string | null;
}

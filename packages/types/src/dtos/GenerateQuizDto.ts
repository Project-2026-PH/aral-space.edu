import { QuizQuestion } from '../models/QuizQuestion';

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
}

export interface HandoutPage {
  pageNumber: number;
  text: string;
  chapterTitle?: string;
}

export interface IngestedFileInfo {
  fileName: string;
  pageCount: number;
  fileSize?: number;
}

export interface UserAuthoringProfile {
  targetCount: number;
  sourceType: 'manual' | 'ai_adjusted' | 'default';
  sampleQuestions?: Array<{
    question: string;
    options: string[];
    explanation?: string;
  }>;
  styleSummary?: string;
  avgQuestionLength?: number;
  avgOptionCount?: number;
  totalReviewersAnalyzed?: number;
}

export type AiPipelineMode = 'auto' | 'two_stage' | 'groq_direct' | 'gemini_direct' | 'verbatim_exact';

export interface VerbatimTermPair {
  term: string;
  verbatim_definition: string;
  source_page: number;
  chapter?: string;
}

export interface GenerateQuizRequestDto {
  subjectId?: string;
  title?: string;
  handoutName?: string;
  handoutPath?: string;
  text?: string;
  pdfPages?: HandoutPage[];
  filesSummary?: IngestedFileInfo[];
  pageStart?: number;
  pageEnd?: number;
  pipelineMode?: AiPipelineMode;
  apiKey?: string;
  groqApiKey?: string;
  authoringProfile?: UserAuthoringProfile;
}

export interface QuizGenerationProgressDto {
  progress: number;
  message: string;
  detail?: string;
  quizId?: string;
  tokensCount?: number;
  stage?: 'extracting' | 'reviewing' | 'complete' | 'fallback' | 'error';
  stageNumber?: number;
  totalStages?: number;
  modelUsed?: string;
  pipelineMode?: AiPipelineMode;
  authoringProfile?: UserAuthoringProfile;
}

export interface RawAiQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  source_pages?: number[];
  chapter?: string;
}

export interface GeneratedQuizResult {
  questions: RawAiQuestion[];
  sourceModel: string;
  tokensUsed?: number;
  pipelineMode?: AiPipelineMode | string;
  stage1Model?: string;
  stage2Model?: string;
  reviewedByGroq?: boolean;
}

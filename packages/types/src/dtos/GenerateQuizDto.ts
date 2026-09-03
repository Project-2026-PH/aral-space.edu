import { QuizQuestion } from '../models/QuizQuestion';

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
}

export interface HandoutPage {
  pageNumber: number;
  text: string;
}

export type AiPipelineMode = 'two_stage' | 'groq_direct' | 'gemini_direct';

export interface GenerateQuizRequestDto {
  subjectId?: string;
  title?: string;
  handoutName?: string;
  handoutPath?: string;
  text?: string;
  pdfPages?: HandoutPage[];
  pageStart?: number;
  pageEnd?: number;
  pipelineMode?: AiPipelineMode;
  apiKey?: string;
  groqApiKey?: string;
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
}

export interface RawAiQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  source_pages?: number[];
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

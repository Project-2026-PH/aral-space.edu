import { QuizQuestion } from '../models/QuizQuestion';

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
}

export interface HandoutPage {
  pageNumber: number;
  text: string;
}

export interface GenerateQuizRequestDto {
  subjectId?: string;
  title?: string;
  handoutName?: string;
  handoutPath?: string;
  text?: string;
  pdfPages?: HandoutPage[];
  pageStart?: number;
  pageEnd?: number;
}

export interface QuizGenerationProgressDto {
  progress: number;
  message: string;
  detail?: string;
  quizId?: string;
  tokensCount?: number;
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
}

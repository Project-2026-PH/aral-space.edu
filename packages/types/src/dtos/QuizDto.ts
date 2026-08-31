import { QuizQuestion } from '../models/QuizQuestion';

export interface CreateQuizDto {
  title: string;
  subject_id?: string | null;
  handout_name?: string | null;
  source_model?: string;
  questions: Array<{
    question_text: string;
    options: string[];
    correct_answer: number;
    explanation?: string | null;
    source_pages?: number[] | null;
  }>;
}

export interface UpdateQuizDto {
  title?: string;
  subject_id?: string | null;
}

export interface CreateQuestionDto {
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation?: string | null;
  source_pages?: number[] | null;
  order_index?: number;
}

export interface UpdateQuestionDto {
  question_text?: string;
  options?: string[];
  correct_answer?: number;
  explanation?: string | null;
  source_pages?: number[] | null;
}

export interface UpdateShareConfigDto {
  is_public?: boolean;
  allow_cloning?: boolean;
  reset_token?: boolean;
}

export interface PublicQuizDto {
  id: string;
  title: string;
  question_count: number;
  generated_at: string;
  source_model: string;
  share_token: string;
  is_public: boolean;
  allow_cloning: boolean;
  created_at?: string;
  subject?: {
    id: string;
    name: string;
    color: string;
  } | null;
  questions: Array<{
    id: string;
    question_text: string;
    options: string[];
    correct_answer: number;
    explanation?: string | null;
    order_index: number;
  }>;
}

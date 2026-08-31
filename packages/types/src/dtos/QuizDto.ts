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

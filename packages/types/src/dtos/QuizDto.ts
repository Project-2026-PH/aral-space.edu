import { QuizQuestionType } from '../models/QuizQuestion';

export interface QuizQuestionInput {
  question_text: string;
  answer_text?: string | null;
  question_type?: QuizQuestionType | null;
  options?: string[];
  correct_answer?: number;
  explanation?: string | null;
  correct_explanation?: string | null;
  distractor_explanations?: Record<number, string> | null;
  discriminatory_keywords?: string[] | null;
  concept_tags?: string[] | null;
  source_pages?: number[] | null;
}

export interface CreateQuizDto {
  title: string;
  description?: string | null;
  subject_id?: string | null;
  handout_name?: string | null;
  source_model?: string;
  questions: Array<QuizQuestionInput & { order_index?: number }>;
}

export interface UpdateQuizDto {
  title?: string;
  description?: string | null;
  subject_id?: string | null;
}

export interface CreateQuestionDto extends QuizQuestionInput {
  order_index?: number;
}

export interface UpdateQuestionDto {
  question_text?: string;
  answer_text?: string | null;
  question_type?: QuizQuestionType | null;
  options?: string[];
  correct_answer?: number;
  explanation?: string | null;
  correct_explanation?: string | null;
  distractor_explanations?: Record<number, string> | null;
  discriminatory_keywords?: string[] | null;
  concept_tags?: string[] | null;
  source_pages?: number[] | null;
}

export interface UpdateShareConfigDto {
  is_public?: boolean;
  allow_cloning?: boolean;
  reset_token?: boolean;
}

export interface UpdateSubjectShareConfigDto {
  is_public?: boolean;
  reset_token?: boolean;
}

export interface SubjectShareConfig {
  share_token: string;
  is_public: boolean;
}

export interface PublicSubjectQuizDto {
  id: string;
  title: string;
  description?: string | null;
  question_count: number;
  generated_at: string;
  share_token: string;
  is_public: boolean;
  created_at?: string;
}

export interface PublicSubjectDto {
  id: string;
  name: string;
  color: string;
  share_token: string;
  is_public: boolean;
  created_at?: string;
  quizzes: PublicSubjectQuizDto[];
}

export interface PublicQuizDto {
  id: string;
  title: string;
  description?: string | null;
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
    answer_text?: string | null;
    question_type?: QuizQuestionType | null;
    options: string[];
    correct_answer: number;
    explanation?: string | null;
    correct_explanation?: string | null;
    distractor_explanations?: Record<number, string> | null;
    discriminatory_keywords?: string[] | null;
    concept_tags?: string[] | null;
    order_index: number;
  }>;
}

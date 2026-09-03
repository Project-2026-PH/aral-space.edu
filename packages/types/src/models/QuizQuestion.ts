export type QuizQuestionType = 'multiple_choice' | 'typed_answer';

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  /** Explicit answer used by Learn/typed-answer mode. Legacy rows derive this from options[correct_answer]. */
  answer_text?: string | null;
  /** Authoring/practice hint. Legacy rows may omit this and are inferred from their options. */
  question_type?: QuizQuestionType | null;
  /** Legacy option storage and optional multiple-choice choices. */
  options: string[];
  /** Legacy correct option index. New typed-answer cards use 0 when no choices exist. */
  correct_answer: number;
  explanation?: string | null;
  source_pages?: number[] | null;
  order_index: number;
  created_at?: string;
}

export interface ShuffledOption {
  optionId: number;
  text: string;
  isCorrect: boolean;
}

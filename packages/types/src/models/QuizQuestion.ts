export type QuizQuestionType = 'multiple_choice' | 'typed_answer';

export interface ElaborativeFeedback {
  correct_explanation: string;
  distractor_explanations: Record<number, string>;
  discriminatory_keywords: string[];
}

export interface PracticeSessionState {
  activeQueue: string[]; // 7-item question IDs
  completed: string[];
  strugglePile: string[];
  attemptsByQuestion: Record<string, number>;
  unservedQueue?: string[];
}

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
  /** Verbatim rule or principle explaining why the answer is correct. */
  correct_explanation?: string | null;
  /** Map of { [option_index]: "why this choice is incorrect" } targeting common cognitive fallacies. */
  distractor_explanations?: Record<number, string> | null;
  /** Array of specific technical keywords separating the correct choice from the nearest distractor. */
  discriminatory_keywords?: string[] | null;
  source_pages?: number[] | null;
  order_index: number;
  created_at?: string;
}

export interface ShuffledOption {
  optionId: number;
  text: string;
  isCorrect: boolean;
}


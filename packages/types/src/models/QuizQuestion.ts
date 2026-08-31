export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
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

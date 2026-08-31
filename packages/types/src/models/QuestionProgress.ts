export interface QuestionProgress {
  id?: string;
  session_id: string;
  question_id: string;
  streak_count: number;
  has_missed: boolean;
  locked: boolean;
  locked_at?: string | null;
  created_at?: string;
}

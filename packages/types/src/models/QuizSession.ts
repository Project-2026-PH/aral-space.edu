export type SessionType = 'initial' | 'review_24h' | 'review_3d' | 'review_7d' | 'review_14d';
export type SessionStatus = 'in_progress' | 'scheduled' | 'completed';

export interface QuizSession {
  id: string;
  quiz_id: string;
  user_id?: string | null;
  session_type: SessionType;
  status: SessionStatus;
  available_at: string;
  started_at: string;
  completed_at?: string | null;
  created_at?: string;
}

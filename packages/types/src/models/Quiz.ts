import { Subject } from './Subject';
import { QuizQuestion } from './QuizQuestion';

export interface Quiz {
  id: string;
  title: string;
  question_count: number;
  generated_at: string;
  handout_name?: string | null;
  handout_path?: string | null;
  source_model: string;
  subject_id?: string | null;
  user_id?: string | null;
  created_at?: string;
  share_token?: string | null;
  is_public?: boolean;
  allow_cloning?: boolean;
  subject?: Subject | null;
  questions?: QuizQuestion[];
}

export interface QuizMetadata {
  id: string;
  title: string;
  question_count: number;
  generated_at: string;
  handout_name?: string | null;
  source_model: string;
  subject_id?: string | null;
  share_token?: string | null;
  is_public?: boolean;
  allow_cloning?: boolean;
}

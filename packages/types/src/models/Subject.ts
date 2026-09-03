export interface Subject {
  id: string;
  name: string;
  color: string;
  user_id?: string;
  created_at?: string;
  share_token?: string | null;
  is_public?: boolean;
}

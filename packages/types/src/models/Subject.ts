export interface Subject {
  id: string;
  name: string;
  color: string;
  user_id?: string;
  created_at?: string;
  archived_at?: string | null;
  share_token?: string | null;
  is_public?: boolean;
  share_expires_at?: string | null;
  share_revoked_at?: string | null;
  viewer_count?: number;
}

export type SubjectAccessRole = 'owner' | 'collaborator' | 'public';

export interface SubjectAccess {
  subject_id: string;
  /** Public access is read-only; it is never a collaboration membership. */
  role: SubjectAccessRole;
  /** Can edit subject name and color. Owner-only. */
  can_edit: boolean;
  /** Can create reviewer content in the subject and edit its questions/details. */
  can_edit_reviewers: boolean;
  /** Can share or delete the subject. Owner-only. */
  can_manage: boolean;
}

export interface SubjectCollaboratorLink {
  token: string;
  expires_at: string | null;
  used_at?: string | null;
  max_uses?: number;
  uses_count?: number;
  redeemed_by?: string[];
}

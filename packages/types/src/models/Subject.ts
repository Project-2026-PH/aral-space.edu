export interface Subject {
  id: string;
  name: string;
  color: string;
  user_id?: string;
  created_at?: string;
  share_token?: string | null;
  is_public?: boolean;
  share_expires_at?: string | null;
  share_revoked_at?: string | null;
}

export type SubjectAccessRole = 'owner' | 'collaborator';

export interface SubjectAccess {
  subject_id: string;
  role: SubjectAccessRole;
  can_edit: boolean;
  can_manage: boolean;
}

export interface SubjectCollaboratorLink {
  token: string;
  expires_at: string | null;
  used_at?: string | null;
}

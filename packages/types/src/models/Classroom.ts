export type ClassroomRole = 'owner' | 'member';

export interface Classroom {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  role: ClassroomRole;
  member_count: number;
  subject_count: number;
}

export interface ClassroomStudySet {
  id: string;
  title: string;
  description: string | null;
  question_count: number;
  generated_at: string;
}

export interface ClassroomSubject {
  id: string;
  name: string;
  color: string;
  study_sets: ClassroomStudySet[];
}

export interface ClassroomMember {
  user_id: string;
  joined_at: string;
}

export interface ClassroomInviteSummary {
  id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface ClassroomInvite {
  id: string;
  code: string;
  expires_at: string | null;
}

export interface ClassroomDetails extends Classroom {
  subjects: ClassroomSubject[];
  /** Only returned to the class owner. */
  members?: ClassroomMember[];
  /** Only returned to the class owner. */
  invites?: ClassroomInviteSummary[];
}

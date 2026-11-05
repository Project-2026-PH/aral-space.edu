CREATE TABLE IF NOT EXISTS study_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS study_class_members (
  classroom_id UUID NOT NULL REFERENCES study_classes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (classroom_id, user_id)
);

CREATE TABLE IF NOT EXISTS study_class_sets (
  classroom_id UUID NOT NULL REFERENCES study_classes(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  added_by TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (classroom_id, quiz_id)
);

CREATE TABLE IF NOT EXISTS study_class_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES study_classes(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_study_classes_owner ON study_classes(owner_id, archived_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_class_members_user ON study_class_members(user_id, classroom_id);
CREATE INDEX IF NOT EXISTS idx_study_class_sets_quiz ON study_class_sets(quiz_id, classroom_id);
CREATE INDEX IF NOT EXISTS idx_study_class_invites_class ON study_class_invites(classroom_id, created_at DESC);

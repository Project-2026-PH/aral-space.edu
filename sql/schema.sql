-- Quiz Creator Standalone Schema
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  user_id UUID,
  share_token TEXT UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  handout_name TEXT,
  handout_path TEXT,
  source_model TEXT NOT NULL DEFAULT 'manual',
  description TEXT,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  user_id UUID,
  share_token TEXT UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  allow_cloning BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_text TEXT,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  source_pages INTEGER[],
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID,
  session_type TEXT NOT NULL DEFAULT 'initial',
  status TEXT NOT NULL DEFAULT 'in_progress',
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_question_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  streak_count INTEGER NOT NULL DEFAULT 0,
  has_missed BOOLEAN NOT NULL DEFAULT FALSE,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id ON quizzes(subject_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON quiz_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_progress_session ON quiz_question_progress(session_id);

-- Safe additions for databases created from an earlier schema version.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS allow_cloning BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS answer_text TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice';
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_share_token_unique ON subjects(share_token) WHERE share_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_share_token_unique ON quizzes(share_token) WHERE share_token IS NOT NULL;

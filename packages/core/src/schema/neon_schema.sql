-- =============================================================================
-- Neon Serverless Postgres Schema for Quiz Mastery Hub
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#86EFAC',
    user_id TEXT,
    share_token TEXT UNIQUE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    share_expires_at TIMESTAMPTZ,
    share_revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects (user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects (name);

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    question_count INTEGER NOT NULL DEFAULT 0,
    handout_name TEXT,
    handout_path TEXT,
    source_model TEXT NOT NULL DEFAULT 'manual',
    description TEXT,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    user_id TEXT,
    share_token TEXT UNIQUE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    allow_cloning BOOLEAN NOT NULL DEFAULT TRUE,
    allow_public_answer_key BOOLEAN NOT NULL DEFAULT FALSE,
    share_expires_at TIMESTAMPTZ,
    share_revoked_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes (user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id ON quizzes (subject_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_generated_at ON quizzes (generated_at DESC);

-- 3. Quiz Questions Table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    answer_text TEXT,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice',
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer INTEGER NOT NULL DEFAULT 0,
    explanation TEXT,
    source_pages JSONB,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_order ON quiz_questions (quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON quiz_questions (quiz_id, order_index ASC);

-- 4. Quiz Sessions Table
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id TEXT,
    session_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_lookup ON quiz_sessions (quiz_id, user_id, status);
    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_active_lookup ON quiz_sessions (quiz_id, user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON quiz_sessions (quiz_id);

-- 5. Quiz Question Progress Table
CREATE TABLE IF NOT EXISTS quiz_question_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    streak_count INTEGER NOT NULL DEFAULT 0,
    has_missed BOOLEAN NOT NULL DEFAULT false,
    locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_question UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_question_progress_session ON quiz_question_progress (session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_progress_question ON quiz_question_progress (question_id);

-- Safe additions for databases created from an earlier schema version.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS allow_cloning BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS allow_public_answer_key BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS answer_text TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS correct_explanation TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS distractor_explanations JSONB;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS discriminatory_keywords JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_share_token_unique ON subjects (share_token) WHERE share_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_share_token_unique ON quizzes (share_token) WHERE share_token IS NOT NULL;


-- Subject collaboration links are single-use invitations. Redemption is atomic on used_at.
CREATE TABLE IF NOT EXISTS subject_collaborator_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    used_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subject_collaborators (
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subject_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_collaborator_links_subject ON subject_collaborator_links(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_collaborators_user ON subject_collaborators(user_id);
ALTER TABLE subject_collaborator_links ADD COLUMN IF NOT EXISTS used_by TEXT;


-- Distributed request throttling for serverless API instances.
CREATE TABLE IF NOT EXISTS security_rate_limits (
    bucket_key TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_rate_limits_updated_at ON security_rate_limits(updated_at);
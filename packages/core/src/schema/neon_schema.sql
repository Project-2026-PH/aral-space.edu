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
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    user_id TEXT,
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
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer INTEGER NOT NULL,
    explanation TEXT,
    source_pages JSONB,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions (quiz_id);
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

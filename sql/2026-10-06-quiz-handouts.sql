-- Persist one PDF handout per quiz set. The quiz foreign key guarantees cleanup
-- when a set is deleted; pdf_data_base64 keeps this migration compatible with
-- the repository's existing source-document storage until object storage exists.
CREATE TABLE IF NOT EXISTS quiz_handouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_size_bytes BIGINT NOT NULL,
    content_hash TEXT NOT NULL,
    storage_path TEXT,
    pdf_data_base64 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (quiz_id),
    CHECK (mime_type = 'application/pdf'),
    CHECK (file_size_bytes > 0)
);
CREATE INDEX IF NOT EXISTS idx_quiz_handouts_quiz ON quiz_handouts(quiz_id);

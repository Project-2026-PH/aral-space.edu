CREATE TABLE IF NOT EXISTS study_class_subjects (
  classroom_id UUID NOT NULL REFERENCES study_classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  added_by TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (classroom_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_study_class_subjects_subject ON study_class_subjects(subject_id, classroom_id);

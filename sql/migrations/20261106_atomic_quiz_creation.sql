-- Atomic quiz aggregate creation for Supabase.
-- Apply this migration to existing Supabase projects. It is also included in
-- sql/schema.sql for clean installations.

CREATE OR REPLACE FUNCTION public.create_quiz_with_questions(
  p_title TEXT,
  p_slug TEXT,
  p_description TEXT,
  p_term TEXT,
  p_question_count INTEGER,
  p_handout_name TEXT,
  p_source_model TEXT,
  p_subject_id UUID,
  p_share_token TEXT,
  p_user_id UUID,
  p_questions JSONB
)
RETURNS SETOF public.quizzes
LANGUAGE SQL
SECURITY INVOKER
SET search_path = public
AS $$
  WITH created_quiz AS (
    INSERT INTO public.quizzes (
      title, slug, description, term, question_count, handout_name,
      source_model, subject_id, share_token, is_public, allow_cloning, user_id
    )
    VALUES (
      p_title, p_slug, p_description, p_term, p_question_count, p_handout_name,
      COALESCE(p_source_model, 'manual'), p_subject_id, p_share_token, TRUE, TRUE, p_user_id
    )
    RETURNING *
  ),
  created_questions AS (
    INSERT INTO public.quiz_questions (
      quiz_id, question_text, answer_text, answer_terms, enumeration_distractors,
      question_type, options, correct_answer, explanation, correct_explanation,
      distractor_explanations, discriminatory_keywords, source_pages, order_index
    )
    SELECT
      created_quiz.id,
      question.question_text,
      question.answer_text,
      question.answer_terms,
      question.enumeration_distractors,
      question.question_type,
      COALESCE(question.options, '[]'::jsonb),
      COALESCE(question.correct_answer, 0),
      question.explanation,
      question.correct_explanation,
      question.distractor_explanations,
      question.discriminatory_keywords,
      CASE
        WHEN question.source_pages IS NULL OR jsonb_typeof(question.source_pages) <> 'array' THEN NULL
        ELSE ARRAY(SELECT value::INTEGER FROM jsonb_array_elements_text(question.source_pages))
      END,
      question.order_index
    FROM created_quiz
    CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(p_questions, '[]'::jsonb)) AS question(
      question_text TEXT,
      answer_text TEXT,
      answer_terms JSONB,
      enumeration_distractors JSONB,
      question_type TEXT,
      options JSONB,
      correct_answer INTEGER,
      explanation TEXT,
      correct_explanation TEXT,
      distractor_explanations JSONB,
      discriminatory_keywords JSONB,
      source_pages JSONB,
      order_index INTEGER
    )
  )
  SELECT created_quiz.* FROM created_quiz;
$$;

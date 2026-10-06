import { PublicQuizDto, PublicSubjectDto, Quiz, QuizQuestion, Subject } from '@quiz-creator/types';

export function toPublicQuizDto(
  quiz: Quiz,
  questions: QuizQuestion[],
  subject: Subject | null | undefined
): PublicQuizDto {
  const includeAnswerKey = quiz.allow_public_answer_key === true;

  return {
    id: quiz.id,
    title: quiz.title,
    slug: quiz.slug || null,
    description: quiz.description || null,
    question_count: quiz.question_count || questions.length,
    generated_at: quiz.generated_at,
    source_model: quiz.source_model,
    share_token: quiz.share_token || '',
    is_public: quiz.is_public ?? true,
    allow_cloning: quiz.allow_cloning ?? true,
    allow_public_answer_key: includeAnswerKey,
    created_at: quiz.created_at,
    subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
    questions: questions.map((question) => {
      const publicQuestion: PublicQuizDto['questions'][number] = {
        id: question.id,
        question_text: question.question_text,
        question_type: question.question_type || (question.options.length > 1 ? 'multiple_choice' : 'typed_answer'),
        options: question.options,
        order_index: question.order_index
      };

      if (includeAnswerKey) {
        publicQuestion.answer_text = question.answer_text || question.options[question.correct_answer] || null;
        publicQuestion.answer_terms = question.answer_terms || null;
        publicQuestion.enumeration_distractors = question.enumeration_distractors || null;
        publicQuestion.correct_answer = question.correct_answer;
        publicQuestion.explanation = question.explanation || null;
        publicQuestion.correct_explanation = question.correct_explanation || null;
        publicQuestion.distractor_explanations = question.distractor_explanations || null;
        publicQuestion.discriminatory_keywords = question.discriminatory_keywords || null;
      }

      return publicQuestion;
    })
  };
}

export function toPublicSubjectDto(subject: Subject, quizzes: Quiz[]): PublicSubjectDto {
  return {
    id: subject.id,
    name: subject.name,
    color: subject.color,
    share_token: subject.share_token || '',
    is_public: subject.is_public ?? true,
    created_at: subject.created_at,
    quizzes: quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug || null,
      description: quiz.description || null,
      question_count: quiz.question_count,
      generated_at: quiz.generated_at,
      share_token: quiz.share_token || '',
      is_public: quiz.is_public ?? true,
      created_at: quiz.created_at
    }))
  };
}

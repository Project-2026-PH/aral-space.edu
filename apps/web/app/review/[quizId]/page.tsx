import { notFound } from 'next/navigation';
import { Quiz, QuizQuestion } from '@quiz-creator/types';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import FlashcardReview from '@/components/quiz/FlashcardReview';

export default async function ReviewPage({
  params,
  searchParams
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ shareToken?: string; subjectShareToken?: string; subjectId?: string }>;
}) {
  const { quizId } = await params;
  const query = await searchParams;
  const userId = await getAnonymousUserId();
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  let quiz: Quiz | null = await controller.getQuiz(quizId, userId);

  const validShareToken = query.shareToken && query.shareToken !== 'undefined' ? query.shareToken : undefined;
  const validSubjectShareToken = query.subjectShareToken && query.subjectShareToken !== 'undefined' ? query.subjectShareToken : undefined;
  const validSubjectId = query.subjectId && query.subjectId !== 'undefined' ? query.subjectId : undefined;
  const subjectExitHref = validSubjectId && !validSubjectShareToken
    ? `/subjects/${encodeURIComponent(validSubjectId)}`
    : undefined;

  if (!quiz && validShareToken) {
    const sharedQuiz = await quizRepo.getQuizByShareToken(validShareToken);
    if (sharedQuiz && sharedQuiz.id === quizId) {
      quiz = {
        ...sharedQuiz,
        questions: sharedQuiz.questions.map((question): QuizQuestion => ({
          ...question,
          quiz_id: sharedQuiz.id,
          correct_answer: question.correct_answer ?? 0,
        }))
      } as Quiz;
    }
  }

  if (!quiz && validSubjectShareToken) {
    const publicSubject = await quizRepo.getSubjectByShareToken(validSubjectShareToken);
    if (publicSubject && publicSubject.quizzes?.some((q) => q.id === quizId)) {
      const baseQuiz = await quizRepo.getQuizById(quizId);
      if (baseQuiz) {
        const questions = await quizRepo.getQuestionsByQuizId(quizId);
        quiz = {
          ...baseQuiz,
          questions: questions.map((question): QuizQuestion => ({
            ...question,
            quiz_id: baseQuiz.id,
            correct_answer: question.correct_answer ?? 0,
          }))
        } as Quiz;
      }
    }
  }

  if (!quiz) notFound();

  return (
    <FlashcardReview
      quiz={quiz}
      questions={quiz.questions || []}
      shareToken={validShareToken}
      subjectShareToken={validSubjectShareToken}
      exitHref={subjectExitHref}
      userId={userId}
    />
  );
}

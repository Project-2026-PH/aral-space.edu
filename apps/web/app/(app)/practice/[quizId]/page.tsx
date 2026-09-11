import { redirect, notFound } from 'next/navigation';
import { Quiz, QuizQuestion, QuizMode } from '@quiz-creator/types';
import QuizRunner from '@/components/quiz/QuizRunner';
import { MasterySessionController } from '@quiz-creator/controllers/MasterySessionController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getPersonalizedFeedbackForUser } from '@/lib/personalized-feedback';
import { getQuizRepository, getSessionRepository } from '@/lib/db';
import { resolveQuizRoute } from '@/lib/route-locators';

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{
    mode?: string;
    shuffleQuestions?: string;
    shuffleOptions?: string;
    shareToken?: string;
    subjectShareToken?: string;
  }>;
}) {
  const { quizId } = await params;
  const query = await searchParams;
  const mode = (query.mode as QuizMode) || 'flashcard';
  const shuffleQuestions = query.shuffleQuestions === 'true';
  const shuffleOptions = query.shuffleOptions !== 'false';
  const userId = await getAnonymousUserId();

  const [quizRepo, sessionRepo] = await Promise.all([
    getQuizRepository(),
    getSessionRepository()
  ]);
  const sessionController = new MasterySessionController(sessionRepo, quizRepo);

  const validShareToken = query.shareToken && query.shareToken !== 'undefined' ? query.shareToken : undefined;
  const validSubjectShareToken = query.subjectShareToken && query.subjectShareToken !== 'undefined' ? query.subjectShareToken : undefined;
  const match = await resolveQuizRoute(quizRepo, quizId, userId);
  if (match?.isLegacyId && match.entity.slug) {
    const queryString = new URLSearchParams(query as Record<string, string>).toString();
    redirect(`/practice/${encodeURIComponent(match.entity.slug)}${queryString ? `?${queryString}` : ''}`);
  }
  const resolvedQuizId = match?.id || quizId;

  let quiz: Quiz | null = match
    ? await quizRepo.getQuizById(resolvedQuizId, userId)
    : await quizRepo.getQuizById(quizId, userId);

  if (!quiz && validShareToken) {
    const sharedQuiz = await quizRepo.getQuizByShareToken(validShareToken);
    if (sharedQuiz && (sharedQuiz.id === resolvedQuizId || sharedQuiz.slug === quizId)) {
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
    if (publicSubject && publicSubject.quizzes?.some((q) => q.id === resolvedQuizId || q.slug === quizId)) {
      const baseQuiz = await quizRepo.getQuizById(resolvedQuizId);
      if (baseQuiz) {
        const questions = await quizRepo.getQuestionsByQuizId(resolvedQuizId);
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

  const questions = (quiz.questions && quiz.questions.length > 0)
    ? quiz.questions
    : await quizRepo.getQuestionsByQuizId(resolvedQuizId, userId);

  const sessionData = await sessionController.getOrStartSession(resolvedQuizId, 'initial', userId, questions);

  return (
    <QuizRunner
      key={resolvedQuizId}
      quiz={quiz}
      initialQuestions={sessionData.questions}
      initialSession={sessionData.session}
      initialProgress={sessionData.progress}
      mode={mode}
      shuffleQuestions={shuffleQuestions}
      shuffleOptions={shuffleOptions}
      personalizedFeedback={getPersonalizedFeedbackForUser(userId)}
    />
  );
}

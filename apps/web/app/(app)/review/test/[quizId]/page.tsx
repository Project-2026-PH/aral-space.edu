import { redirect, notFound } from 'next/navigation';
import type { Quiz, QuizQuestion } from '@quiz-creator/types';
import QuizRunner from '@/components/quiz/QuizRunner';
import { MasterySessionController } from '@quiz-creator/controllers/MasterySessionController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getPersonalizedFeedbackForUser } from '@/lib/personalized-feedback';
import { getQuizRepository, getSessionRepository } from '@/lib/db';
import { resolveQuizRoute } from '@/lib/route-locators';

export default async function LearnTestPage({ params, searchParams }: { params: Promise<{ quizId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { quizId } = await params; const query = await searchParams; const userId = await getAnonymousUserId();
  const [quizRepo, sessionRepo] = await Promise.all([getQuizRepository(), getSessionRepository()]);
  const match = await resolveQuizRoute(quizRepo, quizId, userId);
  if (match?.isLegacyId && match.entity.slug) { const qs = new URLSearchParams(query as Record<string, string>).toString(); redirect(`/review/test/${encodeURIComponent(match.entity.slug)}${qs ? `?${qs}` : ''}`); }
  const resolvedQuizId = match?.id || quizId; const validShareToken = query.shareToken && query.shareToken !== 'undefined' ? query.shareToken : undefined; const validSubjectShareToken = query.subjectShareToken && query.subjectShareToken !== 'undefined' ? query.subjectShareToken : undefined;
  let quiz: Quiz | null = match ? await quizRepo.getQuizById(resolvedQuizId, userId) : await quizRepo.getQuizById(quizId, userId);
  if (!quiz && validShareToken) { const shared = await quizRepo.getQuizByShareToken(validShareToken); if (shared && (shared.id === resolvedQuizId || shared.slug === quizId)) quiz = { ...shared, questions: shared.questions.map((q): QuizQuestion => ({ ...q, quiz_id: shared.id, correct_answer: q.correct_answer ?? 0 })) } as Quiz; }
  if (!quiz && validSubjectShareToken) { const subject = await quizRepo.getSubjectByShareToken(validSubjectShareToken); if (subject?.quizzes?.some((q) => q.id === resolvedQuizId || q.slug === quizId)) { const base = await quizRepo.getQuizById(resolvedQuizId); if (base) quiz = { ...base, questions: await quizRepo.getQuestionsByQuizId(resolvedQuizId) } as Quiz; } }
  if (!quiz) notFound();
  const questions = quiz.questions?.length ? quiz.questions : await quizRepo.getQuestionsByQuizId(resolvedQuizId, userId);
  const session = await new MasterySessionController(sessionRepo, quizRepo).getOrStartSession(resolvedQuizId, 'initial', userId, questions);
  return <QuizRunner key={resolvedQuizId} quiz={quiz} initialQuestions={session.questions} initialSession={session.session} initialProgress={session.progress} mode="learn" shuffleQuestions={query.shuffleQuestions === 'true'} shuffleOptions={query.shuffleOptions !== 'false'} personalizedFeedback={getPersonalizedFeedbackForUser(userId)} />;
}

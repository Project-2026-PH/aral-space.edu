import { notFound } from 'next/navigation';
import QuizRunner from '@/components/quiz/QuizRunner';
import { MasterySessionController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository, getSessionRepository } from '@/lib/db';
import { QuizMode } from '@quiz-creator/types';

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{
    mode?: string;
    shuffleQuestions?: string;
    shuffleOptions?: string;
  }>;
}) {
  const { quizId } = await params;
  const query = await searchParams;
  const mode = (query.mode as QuizMode) || 'learn';
  const shuffleQuestions = query.shuffleQuestions === 'true';
  const shuffleOptions = query.shuffleOptions !== 'false';
  const userId = await getAnonymousUserId();

  const [quizRepo, sessionRepo] = await Promise.all([
    getQuizRepository(),
    getSessionRepository()
  ]);
  const sessionController = new MasterySessionController(sessionRepo, quizRepo);

  // Verify ownership before creating or reusing a session.
  const quiz = await quizRepo.getQuizById(quizId, userId);
  if (!quiz) notFound();

  const sessionData = await sessionController.getOrStartSession(quizId, 'initial', userId);

  return (
    <QuizRunner
      quiz={quiz}
      initialQuestions={sessionData.questions}
      initialSession={sessionData.session}
      initialProgress={sessionData.progress}
      mode={mode}
      shuffleQuestions={shuffleQuestions}
      shuffleOptions={shuffleOptions}
    />
  );
}

import { notFound } from 'next/navigation';
import { Quiz, QuizQuestion, QuizMode } from '@quiz-creator/types';
import QuizRunner from '@/components/quiz/QuizRunner';
import { MasterySessionController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository, getSessionRepository } from '@/lib/db';

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

  let quiz: Quiz | null = await quizRepo.getQuizById(quizId, userId);
  if (!quiz && query.shareToken) {
    const sharedQuiz = await quizRepo.getQuizByShareToken(query.shareToken);
    if (sharedQuiz && sharedQuiz.id === quizId) {
      quiz = {
        ...sharedQuiz,
        questions: sharedQuiz.questions.map((question): QuizQuestion => ({
          ...question,
          quiz_id: sharedQuiz.id
        }))
      } as Quiz;
    }
  }

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

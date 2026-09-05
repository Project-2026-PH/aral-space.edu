import { notFound } from 'next/navigation';
import QuizOverviewClient from '@/components/quiz/QuizOverviewClient';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const userId = await getAnonymousUserId();
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const quiz = await controller.getQuiz(quizId, userId);

  if (!quiz) notFound();

  return (
    <QuizOverviewClient
      quiz={quiz}
      questions={quiz.questions || []}
      sessions={[]}
    />
  );
}

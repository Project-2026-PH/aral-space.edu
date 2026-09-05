import { notFound } from 'next/navigation';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import FlashcardReview from '@/components/quiz/FlashcardReview';

export default async function ReviewPage({
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

  return <FlashcardReview quiz={quiz} questions={quiz.questions || []} />;
}

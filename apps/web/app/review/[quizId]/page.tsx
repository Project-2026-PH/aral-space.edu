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
  searchParams: Promise<{ shareToken?: string; subjectShareToken?: string }>;
}) {
  const { quizId } = await params;
  const query = await searchParams;
  const userId = await getAnonymousUserId();
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  let quiz: Quiz | null = await controller.getQuiz(quizId, userId);

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

  return (
    <FlashcardReview
      quiz={quiz}
      questions={quiz.questions || []}
      shareToken={query.shareToken}
      subjectShareToken={query.subjectShareToken}
    />
  );
}

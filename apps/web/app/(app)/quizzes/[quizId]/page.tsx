import { redirect, notFound } from 'next/navigation';
import QuizOverviewClient from '@/components/quiz/QuizOverviewClient';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import { resolveQuizRoute } from '@/lib/route-locators';
import { hasReviewerEditAccess, isQuizOwner } from '@/lib/quiz-access';

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const userId = await getAnonymousUserId();
  const quizRepo = await getQuizRepository();
  const match = await resolveQuizRoute(quizRepo, quizId, userId);
  if (!match) notFound();
  if (match.isLegacyId && match.entity.slug) redirect(`/quizzes/${encodeURIComponent(match.entity.slug)}`);

  const controller = new QuizCrudController(quizRepo);
  const quiz = await controller.getQuiz(match.id, userId);

  if (!quiz) notFound();

  const canEditReviewer = await hasReviewerEditAccess(controller, quiz, userId);
  const reviewerOwner = isQuizOwner(quiz, userId);

  return (
    <QuizOverviewClient
      quiz={quiz}
      questions={quiz.questions || []}
      sessions={[]}
      readOnly={!canEditReviewer}
      canDelete={reviewerOwner}
      canManageSharing={reviewerOwner}
    />
  );
}

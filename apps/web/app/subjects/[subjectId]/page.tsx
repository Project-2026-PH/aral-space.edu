import { notFound } from 'next/navigation';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import SubjectOverviewClient from '@/components/subject/SubjectOverviewClient';

export const dynamic = 'force-dynamic';

export default async function SubjectDetailPage({
  params
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const userId = await getAnonymousUserId();
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const { subjects, quizzes } = await controller.listQuizzesAndSubjects(userId);
  const subject = subjects.find((candidate) => candidate.id === subjectId);

  if (!subject || (subject.user_id && subject.user_id !== userId)) {
    notFound();
  }

  return (
    <SubjectOverviewClient
      subject={subject}
      quizzes={quizzes.filter((quiz) => quiz.subject_id === subjectId)}
    />
  );
}

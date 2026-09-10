import { notFound } from 'next/navigation';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
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
  const access = await controller.getSubjectAccess(subjectId, userId);
  if (!access) notFound();
  if (access.role !== 'owner') {
    await controller.recordSubjectView(subjectId, userId);
  }
  const subjects = await controller.listSubjects(userId);
  const subject = subjects.find((candidate) => candidate.id === subjectId);
  if (!subject) notFound();
  const subjectWithViewerCount = access.role === 'owner'
    ? { ...subject, viewer_count: await controller.getSubjectViewerCount(subjectId, userId) }
    : subject;
  const quizzes = await controller.listQuizzesBySubject(subjectId, userId);

  return (
    <SubjectOverviewClient
      subject={subjectWithViewerCount}
      quizzes={quizzes}
      access={access}
    />
  );
}

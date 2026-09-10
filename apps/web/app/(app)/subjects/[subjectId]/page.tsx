import { redirect, notFound } from 'next/navigation';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import { resolveSubjectRoute } from '@/lib/route-locators';
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
  const match = await resolveSubjectRoute(repository, subjectId, userId);
  if (!match) notFound();
  if (match.isLegacyId && match.entity.slug) redirect(`/subjects/${encodeURIComponent(match.entity.slug)}`);

  const controller = new QuizCrudController(repository);
  const access = await controller.getSubjectAccess(match.id, userId);
  if (!access) notFound();
  if (access.role !== 'owner') {
    await controller.recordSubjectView(subjectId, userId);
  }
  const subject = match.entity;
  if (!subject) notFound();
  const subjectWithViewerCount = access.role === 'owner'
    ? { ...subject, viewer_count: await controller.getSubjectViewerCount(match.id, userId) }
    : subject;
  const quizzes = await controller.listQuizzesBySubject(match.id, userId);

  return (
    <SubjectOverviewClient
      subject={subjectWithViewerCount}
      quizzes={quizzes}
      access={access}
    />
  );
}

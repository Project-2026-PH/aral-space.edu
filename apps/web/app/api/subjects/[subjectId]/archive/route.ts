import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import { assertAllowedOrigin, enforceRateLimit } from '@/lib/request-security';
import { revalidateAllQuizDetails, revalidatePublicQuizCaches, revalidatePublicQuizTag, revalidatePublicSubjectCaches, revalidatePublicSubjectTag, revalidateUserLists } from '@/lib/cached-queries';

export async function POST(req: NextRequest, { params }: { params: Promise<{ subjectId: string }> }) {
  try {
    assertAllowedOrigin(req);
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'subject-archive', userId, 20);
    if (rateLimit) return rateLimit;
    const { subjectId } = await params;
    const repository = await getQuizRepository();
    const controller = new QuizCrudController(repository);
    const access = await controller.getSubjectAccess(subjectId, userId);
    if (!access?.can_manage) return NextResponse.json({ error: 'Only the subject owner can archive it.' }, { status: 403 });
    const subject = (await controller.listSubjects(userId)).find((candidate) => candidate.id === subjectId);
    const quizzes = await controller.listQuizzesBySubject(subjectId, userId).catch(() => []);
    const archived = await controller.archiveSubject(subjectId, userId);
    if (!archived) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    if (subject?.share_token) revalidatePublicSubjectTag(subject.share_token);
    for (const quiz of quizzes) {
      if (quiz.share_token) revalidatePublicQuizTag(quiz.share_token);
    }
    revalidatePublicQuizCaches();
    revalidatePublicSubjectCaches();
    revalidateAllQuizDetails();
    revalidateUserLists(userId);
    return NextResponse.json({ archived: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to archive subject' }, { status: 500 });
  }
}

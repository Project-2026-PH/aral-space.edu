import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import { assertAllowedOrigin, enforceRateLimit } from '@/lib/request-security';
import { revalidateUserLists, revalidateUserQuizDetails } from '@/lib/cached-queries';

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
    const archived = await controller.archiveSubject(subjectId, userId);
    if (!archived) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    revalidateUserQuizDetails(userId);
    revalidateUserLists(userId);
    return NextResponse.json({ archived: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to archive subject' }, { status: 500 });
  }
}

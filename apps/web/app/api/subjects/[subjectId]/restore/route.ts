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
    const rateLimit = await enforceRateLimit(req, 'subject-restore', userId, 20);
    if (rateLimit) return rateLimit;
    const { subjectId } = await params;
    const repository = await getQuizRepository();
    const controller = new QuizCrudController(repository);
    const subject = (await controller.listArchivedSubjects(userId)).find((candidate) => candidate.id === subjectId);
    if (!subject) return NextResponse.json({ error: 'Archived subject not found' }, { status: 404 });
    const restored = await controller.restoreSubject(subjectId, userId);
    if (!restored) return NextResponse.json({ error: 'Archived subject not found' }, { status: 404 });
    revalidateUserQuizDetails(userId);
    revalidateUserLists(userId);
    return NextResponse.json({ restored: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to restore subject' }, { status: 500 });
  }
}

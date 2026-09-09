import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import { assertAllowedOrigin, enforceRateLimit } from '@/lib/request-security';
import { revalidatePublicQuizCaches, revalidatePublicQuizTag, revalidatePublicSubjectCaches, revalidateQuizTag, revalidateUserLists } from '@/lib/cached-queries';

export async function POST(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    assertAllowedOrigin(req);
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'quiz-restore', userId, 20);
    if (rateLimit) return rateLimit;
    const { quizId } = await params;
    const repository = await getQuizRepository();
    const controller = new QuizCrudController(repository);
    const quiz = (await controller.listArchivedQuizzes(userId)).find((candidate) => candidate.id === quizId);
    if (!quiz) return NextResponse.json({ error: 'Archived reviewer not found' }, { status: 404 });
    const restored = await controller.restoreQuiz(quizId, userId);
    if (!restored) return NextResponse.json({ error: 'Archived reviewer not found' }, { status: 404 });
    if (quiz.share_token) revalidatePublicQuizTag(quiz.share_token);
    revalidatePublicQuizCaches();
    revalidatePublicSubjectCaches();
    revalidateQuizTag(quizId, userId, quiz.subject_id);
    revalidateUserLists(userId);
    return NextResponse.json({ restored: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to restore reviewer' }, { status: 500 });
  }
}

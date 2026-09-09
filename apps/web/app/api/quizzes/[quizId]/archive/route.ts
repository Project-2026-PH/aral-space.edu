import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import { assertAllowedOrigin, enforceRateLimit } from '@/lib/request-security';
import { revalidateUserLists, revalidateUserQuizDetails } from '@/lib/cached-queries';
import { isQuizOwner } from '@/lib/quiz-access';

export async function POST(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    assertAllowedOrigin(req);
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'quiz-archive', userId, 20);
    if (rateLimit) return rateLimit;
    const { quizId } = await params;
    const repository = await getQuizRepository();
    const controller = new QuizCrudController(repository);
    const quiz = await controller.getQuizById(quizId, userId);
    if (!quiz || !isQuizOwner(quiz, userId)) return NextResponse.json({ error: 'Only the reviewer owner can archive it.' }, { status: 403 });
    const archived = await controller.archiveQuiz(quizId, userId);
    if (!archived) return NextResponse.json({ error: 'Reviewer not found' }, { status: 404 });
    revalidateUserQuizDetails(userId);
    revalidateUserLists(userId);
    return NextResponse.json({ archived: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to archive reviewer' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { getAnonymousUserId } from '@/lib/anonymous';
import { revalidateUserLists } from '@/lib/cached-queries';
import { assertAllowedOrigin, boundedString, enforceRateLimit, RequestSecurityError } from '@/lib/request-security';

export async function POST(req: NextRequest, { params }: { params: Promise<{ shareToken: string }> }) {
  try {
    assertAllowedOrigin(req);
    const { shareToken: rawToken } = await params;
    const shareToken = boundedString(rawToken, 'shareToken', 128, true)!;
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(shareToken)) throw new RequestSecurityError(404, 'Shared set not found or access is restricted.');
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'public-quiz-clone', userId, 10);
    if (rateLimit) return rateLimit;
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const clonedQuiz = await controller.cloneQuizByShareToken(shareToken, userId);
    revalidateUserLists(userId);
    return NextResponse.json(clonedQuiz, { status: 201 });
  } catch (err: any) {
    const status = err instanceof RequestSecurityError ? err.status : 400;
    return NextResponse.json({ error: err?.message || 'Clone failed' }, { status });
  }
}

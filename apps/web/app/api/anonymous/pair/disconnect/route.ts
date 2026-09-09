import { NextRequest, NextResponse } from 'next/server';
import {
  ANON_COOKIE_NAME,
  anonymousCookieOptions,
  anonymousLabel,
  createAnonymousSessionValue,
  getAnonymousUserId,
  isValidAnonymousUserId,
} from '@/lib/anonymous';
import { assertAllowedOrigin, enforceRateLimit } from '@/lib/request-security';
import { RepositoryFactory } from '@quiz-creator/core/repositories';
import { revalidateAllQuizDetails, revalidateUserLists } from '@/lib/cached-queries';

/**
 * Disconnects only this device from its current anonymous session by rotating
 * its guest identity. Existing quizzes remain under the previous identity.
 */
export async function POST(req: NextRequest) {
  try {
    assertAllowedOrigin(req);

    const currentAnonId = await getAnonymousUserId(req);
    if (!isValidAnonymousUserId(currentAnonId)) {
      return NextResponse.json({ error: 'Valid authenticated session required' }, { status: 401 });
    }

    const rateLimit = await enforceRateLimit(
      req,
      'anonymous-pair-disconnect',
      currentAnonId,
      5,
      60 * 60 * 1000
    );
    if (rateLimit) return rateLimit;

    const newAnonId = `anon_${crypto.randomUUID()}`;
    RepositoryFactory.clearSharedQuizCache();
    revalidateAllQuizDetails();
    revalidateUserLists(currentAnonId);
    revalidateUserLists(newAnonId);
    const response = NextResponse.json({
      success: true,
      label: anonymousLabel(newAnonId),
      userId: newAnonId,
      message: 'Disconnected from the shared guest session',
    });
    response.cookies.set(
      ANON_COOKIE_NAME,
      await createAnonymousSessionValue(newAnonId),
      anonymousCookieOptions()
    );
    return response;
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return NextResponse.json(
      { error: err.message || 'Unable to disconnect guest session' },
      { status }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  ANON_COOKIE_NAME,
  anonymousCookieOptions,
  anonymousLabel,
  createAnonymousSessionValue,
  getAnonymousUserId,
  isValidAnonymousUserId,
} from '@/lib/anonymous';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { getQuizRepository, getSessionRepository } from '@/lib/db';
import { clearPairingTicketsForUser } from '@/lib/anonymous-pairing';
import { RepositoryFactory } from '@quiz-creator/core/repositories';
import { revalidateAllQuizDetails, revalidatePublicQuizCaches, revalidatePublicSubjectCaches, revalidateUserLists } from '@/lib/cached-queries';

export async function GET(req: NextRequest) {
  try {
    const anonId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'anonymous-session-read', anonId, 30);
    if (rateLimit) return rateLimit;
    const response = NextResponse.json({
      isAnonymous: true,
      label: anonymousLabel(anonId),
      userId: anonId
    });
    response.cookies.set(ANON_COOKIE_NAME, await createAnonymousSessionValue(anonId), anonymousCookieOptions());
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unable to create guest session' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertAllowedOrigin(req);
    const body = await readJsonBody(req, SECURITY_LIMITS.sessionBodyBytes);
    const action = boundedString(body.action, 'action', 16, true);
    if (action !== 'reset') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const currentAnonId = await getAnonymousUserId(req);
    if (!isValidAnonymousUserId(currentAnonId)) {
      return NextResponse.json({ error: 'Valid authenticated session required' }, { status: 401 });
    }
    const confirmation = boundedString(body.confirmation, 'confirmation', 64, true);
    if (confirmation !== anonymousLabel(currentAnonId)) {
      return NextResponse.json({ error: 'Guest ID confirmation does not match this session' }, { status: 400 });
    }

    const rateLimit = await enforceRateLimit(req, 'anonymous-session-reset', currentAnonId, 5, 60 * 60 * 1000);
    if (rateLimit) return rateLimit;

    const cleanupErrors: string[] = [];
    const rememberCleanupError = (phase: string, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      cleanupErrors.push(`${phase}: ${message}`);
    };

    // Each cleanup phase is idempotent. Attempt all phases in this request so a
    // transient failure in one store does not prevent the others from being
    // cleaned, and a retry with the unchanged cookie can finish the remaining work.
    try {
      const quizRepository = await getQuizRepository();
      if (!quizRepository.purgeUserData) {
        throw new Error('Persistent guest data deletion is unavailable');
      }
      await quizRepository.purgeUserData(currentAnonId);
    } catch (error) {
      rememberCleanupError('Quiz data cleanup', error);
    }

    try {
      const sessionRepository = await getSessionRepository();
      if (!sessionRepository.purgeUserData) {
        throw new Error('Persistent session deletion is unavailable');
      }
      await sessionRepository.purgeUserData(currentAnonId);
    } catch (error) {
      rememberCleanupError('Session data cleanup', error);
    }

    try {
      await clearPairingTicketsForUser(currentAnonId);
    } catch (error) {
      rememberCleanupError('Pairing-ticket cleanup', error);
    }

    // Invalidate even after a partial failure so no already-deleted data remains
    // available from a process-local or Next data cache while the user retries.
    RepositoryFactory.clearSharedQuizCache();
    revalidateUserLists(currentAnonId);
    revalidateAllQuizDetails();
    revalidatePublicQuizCaches();
    revalidatePublicSubjectCaches();

    if (cleanupErrors.length > 0) {
      throw new Error(`Guest session cleanup incomplete; retry New Session to finish deletion. ${cleanupErrors.join('; ')}`);
    }

    const newAnonId = `anon_${crypto.randomUUID()}`;
    const response = NextResponse.json({
      success: true,
      label: anonymousLabel(newAnonId),
      userId: newAnonId,
      message: 'Anonymous session reset successfully'
    });
    response.cookies.set(ANON_COOKIE_NAME, await createAnonymousSessionValue(newAnonId), anonymousCookieOptions());
    return response;
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return NextResponse.json({ error: err.message || 'Unable to reset guest session' }, { status });
  }
}

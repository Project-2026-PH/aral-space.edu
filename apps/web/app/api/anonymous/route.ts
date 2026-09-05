import { NextRequest, NextResponse } from 'next/server';
import {
  ANON_COOKIE_NAME,
  anonymousCookieOptions,
  anonymousLabel,
  createAnonymousSessionValue,
  getAnonymousUserId,
} from '@/lib/anonymous';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

export async function GET(req: NextRequest) {
  try {
    const anonId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'anonymous-session-read', anonId, 30);
    if (rateLimit) return rateLimit;
    const response = NextResponse.json({
      isAnonymous: true,
      label: anonymousLabel(anonId)
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
    const rateLimit = await enforceRateLimit(req, 'anonymous-session-reset', currentAnonId, 5, 60 * 60 * 1000);
    if (rateLimit) return rateLimit;
    const newAnonId = `anon_${crypto.randomUUID()}`;
    const response = NextResponse.json({
      success: true,
      label: anonymousLabel(newAnonId),
      message: 'Anonymous session reset successfully'
    });
    response.cookies.set(ANON_COOKIE_NAME, await createAnonymousSessionValue(newAnonId), anonymousCookieOptions());
    return response;
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return NextResponse.json({ error: err.message || 'Unable to reset guest session' }, { status });
  }
}

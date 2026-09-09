import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getCachedPublicQuiz } from '@/lib/cached-queries';
import { boundedString, enforceRateLimit, RequestSecurityError } from '@/lib/request-security';

export const GET = createApiRoute<{ shareToken: string }>(async ({ req, params }) => {
  const token = boundedString(params.shareToken, 'shareToken', 128, true)!;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(token)) throw new RequestSecurityError(404, 'Study set not found or access is restricted');
  const rateLimit = await enforceRateLimit(req, 'public-quiz-read', undefined, 120);
  if (rateLimit) return rateLimit;
  const publicQuiz = await getCachedPublicQuiz(token);
  if (!publicQuiz) return NextResponse.json({ error: 'Study set not found or access is restricted' }, { status: 404 });
  return publicQuiz;
}, { cache: 'noStore', skipAuth: true });

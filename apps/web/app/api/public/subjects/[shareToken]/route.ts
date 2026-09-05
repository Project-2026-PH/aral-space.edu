import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getCachedPublicSubject } from '@/lib/cached-queries';
import { boundedString, enforceRateLimit, RequestSecurityError } from '@/lib/request-security';

export const GET = createApiRoute<{ shareToken: string }>(async ({ req, params }) => {
  const token = boundedString(params.shareToken, 'shareToken', 128, true)!;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(token)) throw new RequestSecurityError(404, 'Subject not found or access is restricted');
  const rateLimit = await enforceRateLimit(req, 'public-subject-read', undefined, 120);
  if (rateLimit) return rateLimit;
  const subject = await getCachedPublicSubject(token);
  if (!subject) return NextResponse.json({ error: 'Subject not found or access is restricted' }, { status: 404 });
  return { ...subject, quizzes: Array.isArray(subject.quizzes) ? subject.quizzes : [] };
}, { cache: 'public', skipAuth: true });

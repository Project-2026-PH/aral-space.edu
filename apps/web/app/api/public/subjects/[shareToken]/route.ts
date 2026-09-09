import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { createApiRoute } from '@/lib/api-handler';
import { getQuizRepository } from '@/lib/db';
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
}, { cache: 'noStore', skipAuth: true });

export const POST = createApiRoute<{ shareToken: string }>(async ({ req, params, userId }) => {
  const token = boundedString(params.shareToken, 'shareToken', 128, true)!;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(token)) throw new RequestSecurityError(404, 'Subject not found or access is restricted');
  const rateLimit = await enforceRateLimit(req, 'public-subject-view', userId, 60);
  if (rateLimit) return rateLimit;
  const subject = await getCachedPublicSubject(token);
  if (!subject) return NextResponse.json({ error: 'Subject not found or access is restricted' }, { status: 404 });
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  await controller.recordSubjectView(subject.id, userId);
  return { recorded: true };
}, { cache: 'private' });

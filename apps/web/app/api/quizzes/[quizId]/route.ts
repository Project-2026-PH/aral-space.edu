import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { assertAllowedOrigin, enforceRateLimit, readJsonBody } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { parseUpdateQuiz } from '@/lib/request-validation';
import { getCachedQuiz, revalidatePublicQuizTag, revalidatePublicSubjectCaches, revalidateQuizTag, revalidateUserLists } from '@/lib/cached-queries';

export const GET = createApiRoute<{ quizId: string }>(async ({ params, userId }) => {
  const quiz = await getCachedQuiz(params.quizId, userId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  return quiz;
}, { cache: 'private' });

export const PATCH = createApiRoute<{ quizId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'quiz-write', userId, 30);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const dto = parseUpdateQuiz(body);
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const before = await controller.getShareConfig(params.quizId, userId).catch(() => null);
  const updated = await controller.updateQuiz(params.quizId, dto, userId);
  if (before?.share_token) revalidatePublicQuizTag(before.share_token);
  revalidateQuizTag(params.quizId, userId);
  revalidatePublicSubjectCaches();
  revalidateUserLists(userId);
  return NextResponse.json(updated);
});

export const DELETE = createApiRoute<{ quizId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'quiz-write', userId, 20);
  if (rateLimit) return rateLimit;
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const before = await controller.getShareConfig(params.quizId, userId).catch(() => null);
  const success = await controller.deleteQuiz(params.quizId, userId);
  if (!success) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (before?.share_token) revalidatePublicQuizTag(before.share_token);
  revalidateQuizTag(params.quizId, userId);
  revalidatePublicSubjectCaches();
  revalidateUserLists(userId);
  return { success };
});

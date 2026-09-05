import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { assertAllowedOrigin, enforceRateLimit, readJsonBody } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { parseSubjectShareConfig } from '@/lib/request-validation';
import { revalidatePublicSubjectCaches, revalidatePublicSubjectTag, revalidateUserLists } from '@/lib/cached-queries';

export const GET = createApiRoute<{ subjectId: string }>(async ({ params, userId }) => {
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  return controller.getSubjectShareConfig(params.subjectId, userId);
});

export const POST = createApiRoute<{ subjectId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'subject-share-write', userId, 20);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const dto = parseSubjectShareConfig(body);
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const before = await controller.getSubjectShareConfig(params.subjectId, userId).catch(() => null);
  const updated = await controller.updateSubjectShareConfig(params.subjectId, dto, userId);
  if (before?.share_token) revalidatePublicSubjectTag(before.share_token);
  if (updated.share_token) revalidatePublicSubjectTag(updated.share_token);
  revalidatePublicSubjectCaches();
  revalidateUserLists(userId);
  return updated;
});

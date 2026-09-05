import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { assertAllowedOrigin, boundedString, enforceRateLimit, RequestSecurityError } from '@/lib/request-security';

export const POST = createApiRoute<{ token: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const token = boundedString(params.token, 'token', 128, true)!;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new RequestSecurityError(410, 'This collaborator link is invalid or expired.');
  const rateLimit = await enforceRateLimit(req, 'collaborator-link-redeem', userId, 10);
  if (rateLimit) return rateLimit;
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const access = await controller.redeemSubjectCollaboratorLink(token, userId);
  if (!access) return NextResponse.json({ error: 'This collaborator link is expired or has already been used.' }, { status: 410 });
  return access;
});

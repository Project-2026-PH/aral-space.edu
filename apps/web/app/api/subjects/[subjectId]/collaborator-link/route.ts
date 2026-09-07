import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

export const POST = createApiRoute<{ subjectId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'collaborator-link-create', userId, 10);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  let expiresAt: string | null = null;
  if (body.expires_at !== undefined && body.expires_at !== null && body.expires_at !== '') {
    const value = boundedString(body.expires_at, 'expires_at', 64, true)!;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new RequestSecurityError(400, 'Expiry must be in the future.');
    expiresAt = new Date(timestamp).toISOString();
  }
  const rawMaxUses = body.max_uses !== undefined ? Number(body.max_uses) : 5;
  const maxUses = Number.isInteger(rawMaxUses) && rawMaxUses >= 1 && rawMaxUses <= 5 ? rawMaxUses : 5;

  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const link = await controller.createSubjectCollaboratorLink(params.subjectId, expiresAt, userId, maxUses);
  return NextResponse.json(link, { status: 201 });
});

import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { revalidatePublicSubjectCaches, revalidateUserLists } from '@/lib/cached-queries';

function subjectColor(value: unknown): string {
  const color = boundedString(value, 'color', 32) || '#86EFAC';
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RequestSecurityError(400, 'color must be a six-digit hex color');
  return color;
}

export const GET = createApiRoute(async ({ userId }) => {
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const subjects = await controller.listSubjects(userId);
  return { subjects, userId };
}, { cache: 'private' });

export const POST = createApiRoute(async ({ req, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'subject-create', userId, 20);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const name = boundedString(body.name, 'name', 200, true)!;
  const color = subjectColor(body.color);
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const created = await controller.createSubject(name, color, userId);
  revalidateUserLists(userId);
  revalidatePublicSubjectCaches();
  return NextResponse.json(created, { status: 201 });
});

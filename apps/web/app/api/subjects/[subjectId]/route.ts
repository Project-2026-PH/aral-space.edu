import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { revalidatePublicQuizTag, revalidatePublicSubjectCaches, revalidateUserLists } from '@/lib/cached-queries';

function subjectColor(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const color = boundedString(value, 'color', 32, true)!;
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RequestSecurityError(400, 'color must be a six-digit hex color');
  return color;
}

export const GET = createApiRoute<{ subjectId: string }>(async ({ params, userId }) => {
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const access = await controller.getSubjectAccess(params.subjectId, userId);
  if (!access) return NextResponse.json({ error: 'Subject not found or access is restricted' }, { status: 404 });
  const subjects = await controller.listSubjects(userId);
  const subject = subjects.find((candidate) => candidate.id === params.subjectId);
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  const quizzes = await controller.listQuizzesBySubject(params.subjectId, userId);
  return { subject, quizzes, access };
});

export const PATCH = createApiRoute<{ subjectId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'subject-write', userId, 30);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const name = boundedString(body.name, 'name', 200);
  if (body.name !== undefined && !name) throw new RequestSecurityError(400, 'Subject name cannot be empty');
  const color = subjectColor(body.color);
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const updated = await controller.updateSubject(params.subjectId, { name, color }, userId);
  revalidateUserLists(userId);
  revalidatePublicSubjectCaches();
  return NextResponse.json(updated);
});

export const DELETE = createApiRoute<{ subjectId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'subject-write', userId, 20);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  if (body.confirmation_name !== undefined) {
    const confirmation = boundedString(body.confirmation_name, 'confirmation_name', 200, true);
    const subjects = await (await getQuizRepository()).listSubjects(userId);
    const subject = subjects.find((candidate) => candidate.id === params.subjectId);
    if (!subject || confirmation !== subject.name) throw new RequestSecurityError(400, 'The subject name did not match.');
  }
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const quizzesBeforeDelete = await controller.listQuizzesBySubject(params.subjectId, userId).catch(() => []);
  const deleted = await controller.deleteSubject(params.subjectId, userId);
  if (!deleted) throw new Error('Subject not found');
  for (const quiz of quizzesBeforeDelete) {
    if (quiz.share_token) revalidatePublicQuizTag(quiz.share_token);
  }
  revalidateUserLists(userId);
  revalidatePublicSubjectCaches();
  return { deleted: true };
});

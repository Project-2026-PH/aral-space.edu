import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { assertAllowedOrigin, enforceRateLimit, readJsonBody } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { parseCreateQuiz } from '@/lib/request-validation';
import { getCachedQuizzesAndSubjects, revalidatePublicSubjectCaches, revalidateUserLists } from '@/lib/cached-queries';

export const GET = createApiRoute(async ({ userId }) => {
  const { quizzes, subjects } = await getCachedQuizzesAndSubjects(userId);
  return { quizzes, subjects, userId };
}, { cache: 'private' });

export const POST = createApiRoute(async ({ req, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'quiz-create', userId, 20);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const dto = parseCreateQuiz(body);
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  if (dto.subject_id) {
    const access = await controller.getSubjectAccess(dto.subject_id, userId);
    if (!access?.can_edit_reviewers) {
      return NextResponse.json({ error: 'You do not have reviewer edit access to this subject.' }, { status: 403 });
    }
  }
  const created = await controller.createQuiz(dto, userId);
  revalidateUserLists(userId);
  revalidatePublicSubjectCaches();
  return NextResponse.json(created, { status: 201 });
});

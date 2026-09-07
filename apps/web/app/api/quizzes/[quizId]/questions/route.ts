import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { getAnonymousUserId } from '@/lib/anonymous';
import {
  assertAllowedOrigin,
  boundedArray,
  boundedString,
  enforceRateLimit,
  readJsonBody,
  RequestSecurityError
} from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { parseCreateQuestion } from '@/lib/request-validation';
import { revalidatePublicQuizTag, revalidateQuizTag } from '@/lib/cached-queries';

function errorResponse(error: any): NextResponse {
  const status = error instanceof RequestSecurityError ? error.status : typeof error?.status === 'number' ? error.status : 400;
  return NextResponse.json({ error: error?.message || 'Request failed' }, { status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    assertAllowedOrigin(req);
    const { quizId } = await params;
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'quiz-question-write', userId, 60);
    if (rateLimit) return rateLimit;
    const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const accessibleQuiz = await controller.getQuiz(quizId, userId);
    if (!accessibleQuiz || accessibleQuiz.user_id !== userId) return NextResponse.json({ error: 'You do not have edit access to this reviewer.' }, { status: 403 });
    const created = await controller.addQuestion(quizId, parseCreateQuestion(body), userId);
    if (accessibleQuiz.share_token) revalidatePublicQuizTag(accessibleQuiz.share_token);
    revalidateQuizTag(quizId, userId);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    assertAllowedOrigin(req);
    const { quizId } = await params;
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'quiz-question-reorder', userId, 30);
    if (rateLimit) return rateLimit;
    const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
    const questionIds = boundedArray<unknown>(body.questionIds, 'questionIds', SECURITY_LIMITS.maxQuestions);
    if (!questionIds) throw new RequestSecurityError(400, 'questionIds is required');
    const normalizedIds = questionIds.map((id, index) => boundedString(id, `questionIds[${index}]`, 128, true)!);
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const accessibleQuiz = await controller.getQuiz(quizId, userId);
    if (!accessibleQuiz || accessibleQuiz.user_id !== userId) return NextResponse.json({ error: 'You do not have edit access to this reviewer.' }, { status: 403 });
    await controller.reorderQuestions(quizId, normalizedIds, userId);
    if (accessibleQuiz.share_token) revalidatePublicQuizTag(accessibleQuiz.share_token);
    revalidateQuizTag(quizId, userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return errorResponse(err);
  }
}

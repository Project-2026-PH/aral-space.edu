import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { getAnonymousUserId } from '@/lib/anonymous';
import {
  assertAllowedOrigin,
  readJsonBody,
  enforceRateLimit,
  RequestSecurityError
} from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { parseUpdateQuestion } from '@/lib/request-validation';
import { revalidatePublicQuizTag, revalidateQuizTag } from '@/lib/cached-queries';
import { hasReviewerEditAccess } from '@/lib/quiz-access';

function errorResponse(error: any): NextResponse {
  const status = error instanceof RequestSecurityError ? error.status : typeof error?.status === 'number' ? error.status : 400;
  return NextResponse.json({ error: error?.message || 'Request failed' }, { status });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string }> }) {
  try {
    assertAllowedOrigin(req);
    const { quizId, questionId } = await params;
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'quiz-question-write', userId, 60);
    if (rateLimit) return rateLimit;
    const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const accessibleQuiz = await controller.getQuiz(quizId, userId);
    const canEditReviewer = accessibleQuiz && await hasReviewerEditAccess(controller, accessibleQuiz, userId);
    if (!accessibleQuiz || !canEditReviewer) return NextResponse.json({ error: 'You do not have edit access to this reviewer.' }, { status: 403 });
    const updated = await controller.updateQuestion(quizId, questionId, parseUpdateQuestion(body), userId);
    if (accessibleQuiz.share_token) revalidatePublicQuizTag(accessibleQuiz.share_token);
    revalidateQuizTag(quizId, userId);
    return NextResponse.json(updated);
  } catch (err: any) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string }> }) {
  try {
    assertAllowedOrigin(req);
    const { quizId, questionId } = await params;
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'quiz-question-write', userId, 60);
    if (rateLimit) return rateLimit;
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const accessibleQuiz = await controller.getQuiz(quizId, userId);
    const canEditReviewer = accessibleQuiz && await hasReviewerEditAccess(controller, accessibleQuiz, userId);
    if (!accessibleQuiz || !canEditReviewer) return NextResponse.json({ error: 'You do not have edit access to this reviewer.' }, { status: 403 });
    const success = await controller.deleteQuestion(quizId, questionId, userId);
    if (accessibleQuiz.share_token) revalidatePublicQuizTag(accessibleQuiz.share_token);
    revalidateQuizTag(quizId, userId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return errorResponse(err);
  }
}

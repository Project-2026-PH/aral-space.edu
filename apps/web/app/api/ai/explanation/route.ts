import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import {
  assertAllowedOrigin,
  boundedInteger,
  boundedString,
  enforceRateLimit,
  readJsonBody,
  RequestSecurityError,
} from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { getQuizRepository } from '@/lib/db';
import {
  generateServerExplanation,
  getServerQuestionSourceId,
} from '@/lib/ai/serverExplanationEngine';

export const POST = createApiRoute(async ({ req, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'ai-explanation', userId, 12);
  if (rateLimit) return rateLimit;

  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const quizId = boundedString(body.quizId, 'quizId', 128, true)!;
  const questionId = boundedString(body.questionId, 'questionId', 128, true)!;
  const selectedOptionId = boundedInteger(body.selectedOptionId, 'selectedOptionId', -1, 50) ?? null;
  const typedAnswer = boundedString(body.typedAnswer, 'typedAnswer', 1000);

  const repository = await getQuizRepository();
  const questionSet = await repository.getQuestionsByQuizId(quizId, userId);
  const sourceQuestionId = getServerQuestionSourceId(questionId);
  const currentQuestion = questionSet.find((question) => question.id === questionId)
    || questionSet.find((question) => question.id === sourceQuestionId);

  if (!currentQuestion) {
    throw new RequestSecurityError(404, 'Question not found or access is restricted');
  }

  const result = await generateServerExplanation({
    quizId,
    questionId,
    selectedOptionId,
    typedAnswer,
    questionSet,
  });

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}, { cache: 'noStore' });

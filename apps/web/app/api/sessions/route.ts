import { NextRequest, NextResponse } from 'next/server';
import { MasterySessionController } from '@quiz-creator/controllers/MasterySessionController';
import { SessionMasterySummary, SessionType } from '@quiz-creator/types';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository, getSessionRepository } from '@/lib/db';
import {
  assertAllowedOrigin,
  assertPlainObject,
  boundedArray,
  boundedBoolean,
  boundedInteger,
  boundedString,
  enforceRateLimit,
  readJsonBody,
  RequestSecurityError
} from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

const SESSION_TYPES = new Set<SessionType>([
  'initial',
  'review_24h',
  'review_3d',
  'review_7d',
  'review_14d'
]);

function parseSessionType(value: unknown): SessionType {
  const sessionType = value === undefined ? 'initial' : boundedString(value, 'sessionType', 32, true);
  if (!sessionType || !SESSION_TYPES.has(sessionType as SessionType)) {
    throw new RequestSecurityError(400, 'sessionType is invalid');
  }
  return sessionType as SessionType;
}

function parseSummary(value: unknown): SessionMasterySummary | undefined {
  if (value === undefined || value === null) return undefined;
  const summary = assertPlainObject(value, 'summary');
  const deckMedianLatencyMs = boundedInteger(summary.deckMedianLatencyMs, 'summary.deckMedianLatencyMs', 0, 300_000, true)!;
  const bucketsValue = assertPlainObject(summary.buckets, 'summary.buckets');
  const parseQuestionIds = (field: string): string[] => {
    const ids = boundedArray<unknown>(bucketsValue[field], `summary.buckets.${field}`, 100,)!;
    return ids.map((id, index) => boundedString(id, `summary.buckets.${field}[${index}]`, 128, true)!);
  };
  const conceptValue = assertPlainObject(summary.conceptErrorDensity, 'summary.conceptErrorDensity');
  const conceptErrorDensity: Record<string, number> = {};
  const entries = Object.entries(conceptValue);
  if (entries.length > 100) throw new RequestSecurityError(400, 'summary.conceptErrorDensity has too many entries');
  for (const [key, rawValue] of entries) {
    const concept = boundedString(key, 'summary concept tag', 128, true)!;
    conceptErrorDensity[concept] = boundedInteger(rawValue, `summary.conceptErrorDensity.${concept}`, 0, 10_000, true)!;
  }
  return {
    deckMedianLatencyMs,
    buckets: { red: parseQuestionIds('red'), yellow: parseQuestionIds('yellow'), green: parseQuestionIds('green') },
    conceptErrorDensity
  };
}

export async function POST(req: NextRequest) {
  try {
    assertAllowedOrigin(req);
    const userId = await getAnonymousUserId(req);
    const body = await readJsonBody(req, SECURITY_LIMITS.sessionBodyBytes);
    const action = boundedString(body.action, 'action', 16, true);
    if (!action || !['start', 'answer', 'complete'].includes(action)) {
      throw new RequestSecurityError(400, 'Invalid action');
    }

    const rateLimit = await enforceRateLimit(req, `sessions:${action}`, userId, action === 'answer' ? 120 : 20);
    if (rateLimit) return rateLimit;

    if (action === 'start') {
      const quizId = boundedString(body.quizId, 'quizId', 128, true)!;
      const sessionType = parseSessionType(body.sessionType);
      const [sessionRepo, quizRepo] = await Promise.all([getSessionRepository(), getQuizRepository()]);
      const controller = new MasterySessionController(sessionRepo, quizRepo);
      const data = await controller.getOrStartSession(quizId, sessionType, userId);
      return NextResponse.json(data);
    }

    const sessionId = boundedString(body.sessionId, 'sessionId', 128, true)!;
    const sessionRepo = await getSessionRepository();
    const quizRepo = await getQuizRepository();
    const controller = new MasterySessionController(sessionRepo, quizRepo);

    if (action === 'answer') {
      const questionId = boundedString(body.questionId, 'questionId', 128, true)!;
      const isCorrect = boundedBoolean(body.isCorrect, 'isCorrect', true)!;
      const selectedOptionId = boundedInteger(body.selectedOptionId, 'selectedOptionId', 0, 100);
      const answerText = boundedString(body.answerText, 'answerText', 2_000);
      const answerModeValue = boundedString(body.answerMode, 'answerMode', 32);
      if (answerModeValue !== undefined && answerModeValue !== 'learn' && answerModeValue !== 'identification') {
        throw new RequestSecurityError(400, 'answerMode is invalid');
      }
      const submittedAnswer = selectedOptionId !== undefined || answerText !== undefined
        ? { selectedOptionId, answerText, answerMode: answerModeValue as 'learn' | 'identification' | undefined }
        : undefined;
      const sessionType = parseSessionType(body.sessionType);
      const latencyMs = boundedInteger(body.latencyMs, 'latencyMs', 0, 300_000);
      const progress = await controller.recordAnswer(sessionId, questionId, isCorrect, sessionType, userId, latencyMs, submittedAnswer);
      return NextResponse.json(progress);
    }

    const quizId = boundedString(body.quizId, 'quizId', 128, true)!;
    const summary = parseSummary(body.summary);
    const result = await controller.completeSession(sessionId, quizId, userId, summary);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/sessions ERROR]:', err);
    const status = err instanceof RequestSecurityError || typeof err?.status === 'number' ? err.status || 400 : 500;
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status });
  }
}

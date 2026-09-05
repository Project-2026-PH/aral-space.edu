import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { revalidatePublicQuizTag, revalidatePublicSubjectCaches, revalidateQuizTag } from '@/lib/cached-queries';
import { getAnonymousUserId } from '@/lib/anonymous';
import { assertAllowedOrigin, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { parseShareConfig } from '@/lib/request-validation';

function errorResponse(error: any): NextResponse {
  const status = error instanceof RequestSecurityError ? error.status : typeof error?.status === 'number' ? error.status : 400;
  return NextResponse.json({ error: error?.message || 'Request failed' }, { status });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  try {
    const { setId } = await params;
    const userId = await getAnonymousUserId(req);
    const controller = new QuizCrudController(await getQuizRepository());
    return NextResponse.json(await controller.getShareConfig(setId, userId));
  } catch (error: any) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  try {
    assertAllowedOrigin(req);
    const { setId } = await params;
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'quiz-share-write', userId, 20);
    if (rateLimit) return rateLimit;
    const dto = parseShareConfig(await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes));
    const controller = new QuizCrudController(await getQuizRepository());
    const before = await controller.getShareConfig(setId, userId).catch(() => null);
    const updated = await controller.updateShareConfig(setId, dto, userId);
    if (before?.share_token) revalidatePublicQuizTag(before.share_token);
    if (updated.share_token) revalidatePublicQuizTag(updated.share_token);
    revalidatePublicSubjectCaches();
    revalidateQuizTag(setId, userId);
    return NextResponse.json(updated);
  } catch (error: any) {
    return errorResponse(error);
  }
}

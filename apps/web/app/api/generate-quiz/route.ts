import { NextRequest, NextResponse } from 'next/server';
import { QuizGenerationController } from '@quiz-creator/controllers/QuizGenerationController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import { assertAllowedOrigin, enforceRateLimit, readJsonBody, withTimeout, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { parseGenerateQuizRequest } from '@/lib/request-validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: ReturnType<typeof parseGenerateQuizRequest>;
  let userId: string;
  try {
    assertAllowedOrigin(req);
    userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'quiz-generation', userId, 5, 60 * 60 * 1000);
    if (rateLimit) return rateLimit;
    body = parseGenerateQuizRequest(await readJsonBody(req, SECURITY_LIMITS.generationBodyBytes));
  } catch (error: any) {
    const status = error instanceof RequestSecurityError ? error.status : 400;
    return NextResponse.json({ error: error?.message || 'Invalid generation request' }, { status });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  let isClosed = false;

  const sendProgress = async (data: any) => {
    if (isClosed) return;
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      isClosed = true;
    }
  };

  (async () => {
    const startTime = Date.now();
    try {
      const quizRepo = await getQuizRepository();
      const controller = new QuizGenerationController(quizRepo);
      await withTimeout(
        controller.handleStreamingGeneration(body as any, sendProgress, userId),
        SECURITY_LIMITS.generationTimeoutMs,
        'Quiz generation timed out. Please reduce the source material and try again.'
      );
    } catch (err: any) {
      console.error(`[API /generate-quiz ERROR after ${Date.now() - startTime}ms]:`, err);
      await sendProgress({ progress: 0, message: 'Error', detail: err.message || 'Generation failed' });
    } finally {
      if (!isClosed) {
        isClosed = true;
        try { await writer.close(); } catch { /* stream already closed */ }
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

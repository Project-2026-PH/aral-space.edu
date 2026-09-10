import { GoogleGenAI } from '@google/genai';
import { AiModelConfig } from '@quiz-creator/core/services';
import { NextRequest, NextResponse } from 'next/server';
import { assertAllowedOrigin, enforceRateLimit, RequestSecurityError } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    assertAllowedOrigin(req);
    const rateLimit = await enforceRateLimit(req, 'ai-health', undefined, 1, 60_000);
    if (rateLimit) return rateLimit;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'GEMINI_API_KEY is not configured' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const model = AiModelConfig.getGeminiModel();
    const ai = new GoogleGenAI({ apiKey });
    const listedModels = await ai.models.list();
    const availableModels: string[] = [];

    for await (const listedModel of listedModels as AsyncIterable<any>) {
      const name = listedModel?.name || listedModel?.baseModelId;
      if (typeof name === 'string') {
        availableModels.push(name.replace(/^models\//, ''));
      }
    }

    const available = availableModels.includes(model);
    if (!available) {
      return NextResponse.json(
        {
          ok: false,
          error: `Configured Gemini model "${model}" is not available for this key`,
          model,
          available: false
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { ok: true, model, available: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    const statusCode = Number(error?.status || error?.statusCode || error?.response?.status);
    const status = error instanceof RequestSecurityError
      ? error.status
      : statusCode === 401 || statusCode === 403
        ? 502
        : 503;
    const message = error instanceof RequestSecurityError
      ? error.message
      : error?.message || 'Gemini API health check failed';

    console.error('[API /api/ai/health ERROR]:', error);
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PDF_DATA_URL_PATTERN = /^data:application\/pdf;base64,([A-Za-z0-9+/=\s]+)$/i;
const DEFAULT_HANDOUT_NAME = 'source-handout.pdf';

function decodePdfDataUrl(value: string): Uint8Array | null {
  const match = PDF_DATA_URL_PATTERN.exec(value);
  if (!match) return null;

  const base64 = match[1].replace(/\s/g, '');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.toString('ascii', 0, 5) !== '%PDF-') return null;

  return new Uint8Array(bytes);
}

function getSafeFileName(value: string | null | undefined): string {
  const fileName = (value || DEFAULT_HANDOUT_NAME)
    .replace(/[\\/\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();

  return fileName || DEFAULT_HANDOUT_NAME;
}

export const GET = createApiRoute<{ quizId: string }>(async ({ params, userId }) => {
  const repository = await getQuizRepository(false);
  const controller = new QuizCrudController(repository);
  const quiz = await controller.getQuizById(params.quizId, userId);

  if (!quiz?.handout_path) {
    return NextResponse.json({ error: 'Source handout not found' }, { status: 404 });
  }

  const pdfBytes = decodePdfDataUrl(quiz.handout_path);
  if (!pdfBytes) {
    return NextResponse.json({ error: 'Source handout is not a valid PDF' }, { status: 422 });
  }

  const responseBody = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(responseBody).set(pdfBytes);

  return new Response(responseBody, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${getSafeFileName(quiz.handout_name)}"`,
      'Content-Length': String(pdfBytes.byteLength),
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff'
    }
  });
});

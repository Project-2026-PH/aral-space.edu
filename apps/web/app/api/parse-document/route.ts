import { NextRequest, NextResponse } from 'next/server';
import { PdfExtractionService, PdfEncryptedError } from '@quiz-creator/core/services';
import { getAnonymousUserId } from '@/lib/anonymous';
import { assertAllowedOrigin, enforceRateLimit, withTimeout, RequestSecurityError, boundedString } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    assertAllowedOrigin(req);
    const userId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'document-parse', userId, 10, 60 * 60 * 1000);
    if (rateLimit) return rateLimit;
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > SECURITY_LIMITS.documentBytes) throw new RequestSecurityError(413, 'File is too large');

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof Blob)) throw new RequestSecurityError(400, 'Missing file in request form data');
    if (file.size <= 0 || file.size > SECURITY_LIMITS.documentBytes) throw new RequestSecurityError(413, 'File is too large');

    const fileName = boundedString((file as File).name || 'document.pdf', 'file name', 500, true)!;
    if (!/\.pdf$/i.test(fileName) || (file.type && file.type !== 'application/pdf')) {
      throw new RequestSecurityError(415, 'Only PDF documents are accepted');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const header = new TextDecoder('latin1').decode(bytes.subarray(0, 5));
    if (header !== '%PDF-') throw new RequestSecurityError(415, 'The uploaded file is not a valid PDF');

    const result = await withTimeout(
      PdfExtractionService.parsePdf(bytes, fileName),
      SECURITY_LIMITS.documentTimeoutMs,
      'Document parsing timed out'
    );
    const pages = result.pages.filter((page) => PdfExtractionService.isExtractableText(page.text));
    if (pages.length === 0) {
      throw new RequestSecurityError(422, 'The uploaded PDF contains no selectable text. Please upload a text-based PDF or run OCR before uploading.');
    }
    if (result.pageCount > SECURITY_LIMITS.maxPages || pages.length > SECURITY_LIMITS.maxPages) {
      throw new RequestSecurityError(413, `Documents are limited to ${SECURITY_LIMITS.maxPages} pages`);
    }
    const totalText = pages.reduce((total, page) => total + page.text.length, 0);
    if (pages.some((page) => page.text.length > SECURITY_LIMITS.maxPageTextLength) || totalText > SECURITY_LIMITS.maxTotalTextLength) {
      throw new RequestSecurityError(413, 'Extracted document text is too large');
    }
    return NextResponse.json({ pages, pageCount: result.pageCount });
  } catch (err: any) {
    console.error('[API /parse-document ERROR]:', err);
    if (err instanceof PdfEncryptedError || err?.name === 'PdfEncryptedError') {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const status = err instanceof RequestSecurityError ? err.status : typeof err?.status === 'number' ? err.status : 500;
    return NextResponse.json({ error: err?.message || 'Failed to parse document' }, { status });
  }
}

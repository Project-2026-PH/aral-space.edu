import { NextRequest, NextResponse } from 'next/server';
import { SourceDocumentService } from '@quiz-creator/core/services';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getReviewerGenerationRepository } from '@/lib/reviewer-generation-repository';
import { assertAllowedOrigin, enforceRateLimit, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    assertAllowedOrigin(req);
    const ownerId = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'source-document-upload', ownerId, 10, 60 * 60 * 1000);
    if (rateLimit) return rateLimit;

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > SECURITY_LIMITS.documentBytes + 128 * 1024) {
      throw new RequestSecurityError(413, 'File is too large');
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof Blob)) {
      throw new RequestSecurityError(400, 'Missing file in request form data');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const service = new SourceDocumentService(getReviewerGenerationRepository());
    const document = await service.uploadPdf({
      ownerId,
      originalFilename: (file as File).name || 'document.pdf',
      mimeType: file.type || 'application/pdf',
      bytes
    });

    return NextResponse.json({
      documentId: document.id,
      fileName: document.originalFilename,
      fileSizeBytes: document.fileSizeBytes,
      contentHash: document.contentHash,
      pageCount: document.pageCount,
      parseStatus: document.parseStatus,
      status: 'ready'
    }, { status: 201 });
  } catch (error: any) {
    const status = error instanceof RequestSecurityError
      ? error.status
      : typeof error?.status === 'number' ? error.status : 400;
    return NextResponse.json({ error: error?.message || 'Unable to store PDF' }, { status });
  }
}

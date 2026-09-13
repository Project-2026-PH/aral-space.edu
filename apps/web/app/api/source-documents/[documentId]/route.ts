import { NextRequest, NextResponse } from 'next/server';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getReviewerGenerationRepository } from '@/lib/reviewer-generation-repository';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const ownerId = await getAnonymousUserId(req);
    const { documentId } = await context.params;
    const document = await getReviewerGenerationRepository().getSourceDocument(documentId, ownerId);
    if (!document) return NextResponse.json({ error: 'Source document not found' }, { status: 404 });

    return NextResponse.json({
      documentId: document.id,
      fileName: document.originalFilename,
      fileSizeBytes: document.fileSizeBytes,
      contentHash: document.contentHash,
      pageCount: document.pageCount,
      parseStatus: document.parseStatus,
      createdAt: document.createdAt,
      parsedAt: document.parsedAt
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to read source document' }, { status: 500 });
  }
}

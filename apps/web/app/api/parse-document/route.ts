import { NextRequest, NextResponse } from 'next/server';
import { PdfExtractionService } from '@quiz-creator/core/services';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing file in request form data' },
        { status: 400 }
      );
    }

    const fileName = (file as any).name || 'document.pdf';
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const result = await PdfExtractionService.parsePdf(uint8, fileName);

    return NextResponse.json({
      pages: result.pages,
      pageCount: result.pageCount,
    });
  } catch (err: any) {
    console.error('[API /parse-document ERROR]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to parse document' },
      { status: 500 }
    );
  }
}

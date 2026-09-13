import { createHash } from 'node:crypto';
import type { SourceDocument } from '@quiz-creator/types';
import type { ReviewerGenerationRepository } from '../repositories/IReviewerGenerationRepository';

export interface UploadSourceDocumentInput {
  ownerId: string;
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export class SourceDocumentService {
  static readonly MAX_BYTES = 25 * 1024 * 1024;
  static readonly PDF_MIME_TYPE = 'application/pdf';

  constructor(private readonly repository: ReviewerGenerationRepository) {}

  async uploadPdf(input: UploadSourceDocumentInput): Promise<SourceDocument> {
    const filename = input.originalFilename.trim();
    if (!filename || filename.length > 500 || !/\.pdf$/i.test(filename)) {
      throw new Error('Only PDF documents with a valid filename are accepted');
    }
    if (input.mimeType && input.mimeType !== SourceDocumentService.PDF_MIME_TYPE) {
      throw new Error('Only application/pdf documents are accepted');
    }
    if (input.bytes.length <= 0 || input.bytes.length > SourceDocumentService.MAX_BYTES) {
      throw new Error('PDF files must be between 1 byte and 25 MB');
    }

    const header = new TextDecoder('latin1').decode(input.bytes.subarray(0, 5));
    if (header !== '%PDF-') {
      throw new Error('The uploaded file is not a valid PDF');
    }

    const contentHash = createHash('sha256').update(input.bytes).digest('hex');
    const pdfDataBase64 = Buffer.from(input.bytes).toString('base64');
    return this.repository.createSourceDocument({
      ownerId: input.ownerId,
      originalFilename: filename,
      mimeType: SourceDocumentService.PDF_MIME_TYPE,
      fileSizeBytes: input.bytes.length,
      contentHash,
      pdfDataBase64
    });
  }
}

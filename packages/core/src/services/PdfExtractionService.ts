import { HandoutPage } from '@quiz-creator/types';

export class PdfExtractionService {
  static extractTextFromMockOrPlain(text: string): HandoutPage[] {
    const lines = text.split('\n');
    const pages: HandoutPage[] = [];
    let currentPage = 1;
    let currentBuffer: string[] = [];

    lines.forEach((line) => {
      if (line.includes('--- PAGE ') || currentBuffer.length > 50) {
        if (currentBuffer.length > 0) {
          pages.push({ pageNumber: currentPage++, text: currentBuffer.join('\n') });
          currentBuffer = [];
        }
      }
      currentBuffer.push(line);
    });

    if (currentBuffer.length > 0) {
      pages.push({ pageNumber: currentPage, text: currentBuffer.join('\n') });
    }

    return pages.length > 0 ? pages : [{ pageNumber: 1, text }];
  }
}

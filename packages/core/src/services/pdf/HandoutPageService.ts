import { HandoutPage } from '@quiz-creator/types';

/**
 * Domain service for managing and aggregating handout pages,
 * including plaintext chunking and multi-file chapter aggregation.
 */
export class HandoutPageService {
  /**
   * Parses mock or plain text into HandoutPage chunks.
   * Recognizes "--- PAGE X ---" markers or chunks every 50 lines.
   */
  static chunkPlaintext(text: string, chapterTitle?: string): HandoutPage[] {
    const lines = text.split('\n');
    const pages: HandoutPage[] = [];
    let currentPage = 1;
    let currentChapter = chapterTitle;
    let currentBuffer: string[] = [];

    const flushPage = () => {
      if (currentBuffer.length > 0) {
        pages.push({
          pageNumber: currentPage,
          text: currentBuffer.join('\n'),
          chapterTitle: currentChapter
        });
        currentBuffer = [];
        currentPage++;
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      const markerMatch = trimmed.match(/^---\s*PAGE\s*(\d+)?(?:\s*\[Chapter\s*\/\s*File:\s*([^\]]+)\])?\s*---$/i);
      const isMarker = Boolean(markerMatch || line.includes('--- PAGE '));

      if (isMarker) {
        flushPage();
        const pageNum = markerMatch?.[1] || line.match(/PAGE\s*(\d+)/i)?.[1];
        if (pageNum) {
          currentPage = parseInt(pageNum, 10);
        }
        if (markerMatch?.[2]) {
          currentChapter = markerMatch[2].trim();
        }
        return;
      }

      if (currentBuffer.length >= 50) {
        flushPage();
      }

      currentBuffer.push(line);
    });

    flushPage();

    return pages.length > 0 ? pages : [{ pageNumber: 1, text, chapterTitle }];
  }

  /**
   * Aggregates multiple chapter file pages into a unified, categorized HandoutPage[] stream.
   */
  static aggregatePages(files: Array<{ name: string; pages: HandoutPage[] }>): HandoutPage[] {
    const aggregated: HandoutPage[] = [];
    let cumulativePageNumber = 1;

    for (const file of files) {
      for (const p of file.pages) {
        aggregated.push({
          pageNumber: cumulativePageNumber++,
          text: p.text,
          chapterTitle: p.chapterTitle || file.name
        });
      }
    }

    return aggregated;
  }
}

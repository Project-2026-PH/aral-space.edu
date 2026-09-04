import { HandoutPage } from '@quiz-creator/types';
import { IPdfParserStrategy, PdfParseResult } from './IPdfParserStrategy';
import { PdfEncryptedError } from '../errors/PdfEncryptedError';

/**
 * Primary PDF parsing strategy powered by Mozilla's pdfjs-dist.
 * Uses the legacy headless build and dynamic lazy import to protect
 * React Native / Expo and Web bundle boundaries from eager evaluation.
 */
export class PdfJsParserStrategy implements IPdfParserStrategy {
  readonly name = 'pdfjs';

  private static pdfjsModule: any = null;

  private static async getPdfJs(): Promise<any> {
    if (!PdfJsParserStrategy.pdfjsModule) {
      // Dynamic import protects bundle boundaries (e.g. Metro / React Native in @quiz-creator/mobile)
      PdfJsParserStrategy.pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    }
    return PdfJsParserStrategy.pdfjsModule;
  }

  async parse(data: Uint8Array, fileName: string): Promise<PdfParseResult> {
    const pdfjs = await PdfJsParserStrategy.getPdfJs();

    // Ensure data is a fresh, pure Uint8Array with isolated ArrayBuffer
    // to avoid Node Buffer prototype issues and buffer neutering/detachment
    const safeData = new Uint8Array(data.byteLength);
    safeData.set(data);

    try {
      const loadingTask = pdfjs.getDocument({
        data: safeData,
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
      });

      const doc = await loadingTask.promise;
      const pages: HandoutPage[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const items = (textContent.items || []) as Array<{ str?: string; hasEOL?: boolean }>;
        const text = items
          .map((item) => (item.str !== undefined ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join('')
          .trim();

        pages.push({
          pageNumber: i,
          text: text || `[Page ${i} empty or image-only in ${fileName}]`,
          chapterTitle: fileName,
        });
      }

      return {
        pages,
        pageCount: doc.numPages,
      };
    } catch (err: any) {
      if (err?.name === 'PasswordException' || err?.message?.toLowerCase().includes('password')) {
        throw new PdfEncryptedError(fileName, true, `PDF "${fileName}" is encrypted or password-protected.`);
      }
      throw err;
    }
  }
}

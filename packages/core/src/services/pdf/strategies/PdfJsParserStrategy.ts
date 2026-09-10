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

  private static async resolveWorkerSrc(): Promise<string> {
    const resolve = (import.meta as ImportMeta & {
      resolve?: (specifier: string) => string;
    }).resolve;
    const workerSpecifier = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

    if (typeof resolve === 'function') {
      return resolve(workerSpecifier);
    }

    // Vitest and some bundlers expose import.meta without Node's resolve()
    // implementation. Resolve lazily so React Native bundles do not eagerly
    // depend on Node-only modules.
    const [{ createRequire }, { pathToFileURL }] = await Promise.all([
      import('node:module'),
      import('node:url'),
    ]);
    const require = createRequire(import.meta.url);
    return pathToFileURL(require.resolve(workerSpecifier)).href;
  }

  private static async getPdfJs(): Promise<any> {
    if (!PdfJsParserStrategy.pdfjsModule) {
      // Dynamic import protects bundle boundaries (e.g. Metro / React Native in @quiz-creator/mobile)
      const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
      // Node.js uses PDF.js's fake-worker path, which still needs a worker
      // module source to bootstrap the worker implementation. An empty string
      // is treated as "not configured" and causes:
      // `Setting up fake worker failed: No "GlobalWorkerOptions.workerSrc" specified.`
      // Resolve the worker from the installed pdfjs-dist package so this works
      // in Next.js server routes without relying on a browser Worker URL.
      mod.GlobalWorkerOptions.workerSrc = await PdfJsParserStrategy.resolveWorkerSrc();
      PdfJsParserStrategy.pdfjsModule = mod;
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
      if (
        err?.name === 'PasswordException' ||
        err?.message?.toLowerCase().includes('password') ||
        err?.message?.toLowerCase().includes('encrypt')
      ) {
        const requiresPassword = err?.name === 'PasswordException';
        throw new PdfEncryptedError(
          fileName,
          requiresPassword,
          `PDF "${fileName}" is encrypted or password-protected. Please upload an unencrypted PDF.`
        );
      }
      throw err;
    }
  }
}

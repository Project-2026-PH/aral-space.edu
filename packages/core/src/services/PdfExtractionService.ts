import { HandoutPage } from '@quiz-creator/types';
import { IPdfParserStrategy } from './pdf/strategies/IPdfParserStrategy';
import { HandoutPageService } from './pdf/HandoutPageService';
import { PdfEncryptedError } from './pdf/errors/PdfEncryptedError';
import { PdfLiteralDecoder } from './pdf/decoders/PdfLiteralDecoder';
import { PdfHexDecoder } from './pdf/decoders/PdfHexDecoder';
import { PdfFlateDecompressor } from './pdf/decoders/PdfFlateDecompressor';
import { PdfStreamTextExtractor } from './pdf/decoders/PdfStreamTextExtractor';

/**
 * Service façade for PDF document text extraction and handout chunking.
 * Orchestrates Mozilla PDF.js as primary extraction engine with resilient fallback
 * to the stream scanner for synthetic/malformed stream snippets.
 */
export class PdfExtractionService {
  private static primaryStrategy: IPdfParserStrategy | null = null;
  private static fallbackStrategy: IPdfParserStrategy | null = null;

  private static async getPrimaryStrategy(): Promise<IPdfParserStrategy> {
    if (!PdfExtractionService.primaryStrategy) {
      const { PdfJsParserStrategy } = await import('./pdf/strategies/PdfJsParserStrategy');
      PdfExtractionService.primaryStrategy = new PdfJsParserStrategy();
    }
    return PdfExtractionService.primaryStrategy;
  }

  private static async getFallbackStrategy(): Promise<IPdfParserStrategy> {
    if (!PdfExtractionService.fallbackStrategy) {
      const { StreamScannerParserStrategy } = await import('./pdf/strategies/StreamScannerParserStrategy');
      PdfExtractionService.fallbackStrategy = new StreamScannerParserStrategy();
    }
    return PdfExtractionService.fallbackStrategy;
  }

  /**
   * Parses binary PDF data or plain text string into categorized HandoutPage[] streams.
   */
  static async parsePdf(
    input: Uint8Array | ArrayBuffer | string,
    fileName: string = 'Handout.pdf'
  ): Promise<{ pages: HandoutPage[]; pageCount: number }> {
    if (typeof input === 'string') {
      const pages = HandoutPageService.chunkPlaintext(input, fileName);
      return { pages, pageCount: pages.length };
    }

    const uint8 =
      input instanceof Uint8Array
        ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
        : new Uint8Array(input);

    const decoder = new TextDecoder('latin1');
    const headerSnippet = decoder.decode(uint8.subarray(0, Math.min(uint8.length, 4096)));
    const trailerSnippet = decoder.decode(uint8.subarray(Math.max(0, uint8.length - 4096)));
    const sample = headerSnippet + '\n' + trailerSnippet;

    const isConformingPdf =
      trailerSnippet.includes('trailer') ||
      trailerSnippet.includes('startxref') ||
      /\/Type\s*\/XRef\b/.test(sample) ||
      /\/Type\s*\/Catalog\b/.test(sample);
    const isEncrypted = /\/Encrypt\b/.test(sample);

    // Conforming standard PDFs or encrypted documents are parsed via Mozilla PDF.js
    if (isConformingPdf || isEncrypted) {
      try {
        const primary = await PdfExtractionService.getPrimaryStrategy();
        return await primary.parse(uint8, fileName);
      } catch (err: any) {
        // Re-throw encryption/password domain errors immediately — NEVER swallow into fallback
        if (err instanceof PdfEncryptedError || err?.name === 'PdfEncryptedError') {
          throw err;
        }

        console.warn(
          `[PdfExtractionService] PDF.js extraction failed (${err?.name || 'Error'}: ${err?.message}), delegating to fallback stream scanner.`
        );
      }
    }

    // Fallback stream scanner for synthetic test buffers or malformed stream fragments
    const fallback = await PdfExtractionService.getFallbackStrategy();
    return await fallback.parse(uint8, fileName);
  }

  /**
   * Returns false for the synthetic placeholders used when a PDF page has no
   * selectable text. Those placeholders must never be sent to an AI model as
   * if they were document content.
   */
  static isExtractableText(text: string): boolean {
    const normalized = text.trim();
    if (!normalized) return false;
    return !/^\[Page\s+\d+\s+(?:empty or image-only in|extracted from)\s+.+\]$/i.test(normalized);
  }

  // --- Static Compatibility Delegates ---

  static extractTextFromMockOrPlain(text: string, chapterTitle?: string): HandoutPage[] {
    return HandoutPageService.chunkPlaintext(text, chapterTitle);
  }

  static aggregateMultiFilePages(files: Array<{ name: string; pages: HandoutPage[] }>): HandoutPage[] {
    return HandoutPageService.aggregatePages(files);
  }

  static sanitizeExtractedText(text: string): string {
    return PdfStreamTextExtractor.sanitizeExtractedText(text);
  }

  static decodePdfLiteralString(str: string): string {
    return PdfLiteralDecoder.decode(str);
  }

  static decodePdfHexString(hex: string): string {
    return PdfHexDecoder.decode(hex);
  }

  static extractTextFromStream(streamText: string): string {
    return PdfStreamTextExtractor.extractTextFromStream(streamText);
  }

  static async decompressFlate(data: Uint8Array): Promise<Uint8Array | null> {
    return PdfFlateDecompressor.decompress(data);
  }
}

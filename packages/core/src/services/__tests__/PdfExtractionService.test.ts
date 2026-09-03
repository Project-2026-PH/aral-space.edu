import { describe, it, expect } from 'vitest';
import { PdfExtractionService } from '../PdfExtractionService';
import * as zlib from 'zlib';

describe('PdfExtractionService', () => {
  it('extracts plain text and preserves chapterTitle and page markers', () => {
    const text = 'Line 1\nLine 2\n--- PAGE 2 ---\nLine 3';
    const pages = PdfExtractionService.extractTextFromMockOrPlain(text, 'Chapter 1 - Intro.pdf');

    expect(pages.length).toBe(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].chapterTitle).toBe('Chapter 1 - Intro.pdf');
    expect(pages[0].text).toContain('Line 1');
    expect(pages[1].pageNumber).toBe(2);
    expect(pages[1].chapterTitle).toBe('Chapter 1 - Intro.pdf');
    expect(pages[1].text).toContain('Line 3');
  });

  it('decodes PDF literal escape sequences correctly', () => {
    const raw = 'Hello\\nWorld\\t\\(Test\\)\\\\Octal\\101';
    const decoded = PdfExtractionService.decodePdfLiteralString(raw);
    expect(decoded).toBe('Hello\nWorld\t(Test)\\OctalA');
  });

  it('decodes PDF hex strings correctly', () => {
    // "Quiz" in ASCII hex is 5175697a
    const decoded = PdfExtractionService.decodePdfHexString('5175697a');
    expect(decoded).toBe('Quiz');
  });

  it('extracts text from PDF stream tokens (TJ arrays and Tj strings)', () => {
    const stream = `
      BT
      /F1 12 Tf
      [(Hello) 10 (World)] TJ
      (Another line) Tj
      <5175697a> Tj
      ET
    `;
    const text = PdfExtractionService.extractTextFromStream(stream);
    expect(text).toContain('Hello World');
    expect(text).toContain('Another line');
    expect(text).toContain('Quiz');
  });

  it('parses synthetic PDF with page objects and compressed FlateDecode streams', async () => {
    // Build a minimal valid PDF-like buffer with FlateDecode stream
    const pageStreamContent = 'BT (Cellular Respiration and Glycolysis) Tj ET';
    const compressedStream = zlib.deflateSync(Buffer.from(pageStreamContent, 'latin1'));

    const pdfHeader = '%PDF-1.4\n1 0 obj\n<< /Type /Pages /Count 2 >>\nendobj\n';
    const objHeader = '2 0 obj\n<< /Type /Page /Filter /FlateDecode /Length ' + compressedStream.length + ' >>\nstream\n';
    const objFooter = '\nendstream\nendobj\n%%EOF';

    const fullBuffer = Buffer.concat([
      Buffer.from(pdfHeader, 'latin1'),
      Buffer.from(objHeader, 'latin1'),
      compressedStream,
      Buffer.from(objFooter, 'latin1')
    ]);

    const result = await PdfExtractionService.parsePdf(new Uint8Array(fullBuffer), 'Chapter 2 - Biology.pdf');
    expect(result.pageCount).toBe(2);
    expect(result.pages.length).toBe(2);
    expect(result.pages[0].chapterTitle).toBe('Chapter 2 - Biology.pdf');
    expect(result.pages[0].text).toContain('Cellular Respiration and Glycolysis');
  });

  it('aggregates multi-file pages with cumulative page numbers and chapter metadata', () => {
    const files = [
      {
        name: 'Ch1_Anatomy.pdf',
        pages: [
          { pageNumber: 1, text: 'Brain and nervous system' },
          { pageNumber: 2, text: 'Spinal cord' }
        ]
      },
      {
        name: 'Ch2_Physiology.pdf',
        pages: [
          { pageNumber: 1, text: 'Cardiovascular system' }
        ]
      }
    ];

    const aggregated = PdfExtractionService.aggregateMultiFilePages(files);
    expect(aggregated.length).toBe(3);
    expect(aggregated[0].pageNumber).toBe(1);
    expect(aggregated[0].chapterTitle).toBe('Ch1_Anatomy.pdf');
    expect(aggregated[1].pageNumber).toBe(2);
    expect(aggregated[1].chapterTitle).toBe('Ch1_Anatomy.pdf');
    expect(aggregated[2].pageNumber).toBe(3);
    expect(aggregated[2].chapterTitle).toBe('Ch2_Physiology.pdf');
  });
});

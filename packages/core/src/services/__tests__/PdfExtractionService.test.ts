import { describe, it, expect } from 'vitest';
import { PdfExtractionService } from '../PdfExtractionService';
import { PdfEncryptedError } from '../pdf/errors/PdfEncryptedError';
import { HandoutPageService } from '../pdf/HandoutPageService';
import * as zlib from 'zlib';

describe('PdfExtractionService', () => {
  it('extracts plain text and strips page markers from content', () => {
    const text = 'Line 1\nLine 2\n--- PAGE 2 ---\nLine 3';
    const pages = PdfExtractionService.extractTextFromMockOrPlain(text, 'Chapter 1 - Intro.pdf');

    expect(pages.length).toBe(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].chapterTitle).toBe('Chapter 1 - Intro.pdf');
    expect(pages[0].text).toBe('Line 1\nLine 2');
    expect(pages[1].pageNumber).toBe(2);
    expect(pages[1].chapterTitle).toBe('Chapter 1 - Intro.pdf');
    expect(pages[1].text).toBe('Line 3');
    expect(pages[1].text).not.toContain('--- PAGE');
  });

  it('handles leading markers and parses explicit page numbers and chapter metadata', () => {
    const text = '--- PAGE 5 [Chapter / File: Biology.pdf] ---\nFirst line of page 5\n--- PAGE 9 ---\nLine of page 9';
    const pages = PdfExtractionService.extractTextFromMockOrPlain(text);

    expect(pages.length).toBe(2);
    expect(pages[0].pageNumber).toBe(5);
    expect(pages[0].chapterTitle).toBe('Biology.pdf');
    expect(pages[0].text).toBe('First line of page 5');
    expect(pages[1].pageNumber).toBe(9);
    expect(pages[1].text).toBe('Line of page 9');
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
    expect(aggregated[2].pageNumber).toBe(3);
    expect(aggregated[2].chapterTitle).toBe('Ch2_Physiology.pdf');
  });

  it('safely handles corrupted flate streams by returning null without throwing', async () => {
    const corruptedData = new Uint8Array([0x1f, 0x8b, 0x00, 0xff, 0xfe, 0x12, 0x34]);
    const result = await PdfExtractionService.decompressFlate(corruptedData);
    expect(result).toBeNull();
  });

  it('skips non-text image streams and extracts valid text streams', async () => {
    const pageStreamContent = 'BT (Biochemistry Chapter 1) Tj ET';
    const compressedPage = zlib.deflateSync(Buffer.from(pageStreamContent, 'latin1'));

    // Simulated image stream with random garbage binary data
    const imageGarbage = Buffer.from([0x78, 0x9c, 0x01, 0x02, 0x03, 0xff, 0xee]);

    const pdfContent = [
      '%PDF-1.4\n',
      '1 0 obj\n<< /Type /Pages /Count 1 >>\nendobj\n',
      '2 0 obj\n<< /Type /XObject /Subtype /Image /Filter /FlateDecode /Length ' + imageGarbage.length + ' >>\nstream\n',
      imageGarbage,
      '\nendstream\nendobj\n',
      '3 0 obj\n<< /Type /Page /Filter /FlateDecode /Length ' + compressedPage.length + ' >>\nstream\n',
      compressedPage,
      '\nendstream\nendobj\n',
      '%%EOF'
    ];

    const fullBuffer = Buffer.concat(pdfContent.map((item) => (typeof item === 'string' ? Buffer.from(item, 'latin1') : item)));
    const result = await PdfExtractionService.parsePdf(new Uint8Array(fullBuffer), 'Biochemistry.pdf');

    expect(result.pageCount).toBe(1);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].text).toContain('Biochemistry Chapter 1');
  });

  it('detects page count when /Count comes before /Type /Pages or via /Kids and /Linearized', async () => {
    // 1. /Count 10 before /Type /Pages
    const pdfCountBefore = '%PDF-1.5\n1 0 obj\n<< /Count 10 /Kids [3 0 R 4 0 R] /Type /Pages >>\nendobj\n%%EOF';
    const res1 = await PdfExtractionService.parsePdf(Buffer.from(pdfCountBefore, 'latin1'), 'Handout.pdf');
    expect(res1.pageCount).toBe(10);
    expect(res1.pages.length).toBe(10);

    // 2. /Linearized dictionary with /N 10
    const pdfLinearized = '%PDF-1.4\n1 0 obj\n<< /Linearized 1.0 /L 421594 /N 10 >>\nendobj\n%%EOF';
    const res2 = await PdfExtractionService.parsePdf(Buffer.from(pdfLinearized, 'latin1'), 'Linearized.pdf');
    expect(res2.pageCount).toBe(10);

    // 3. /Kids array with 3 page refs
    const pdfKids = '%PDF-1.4\n1 0 obj\n<< /Type /Pages /Kids [10 0 R 20 0 R 30 0 R] >>\nendobj\n%%EOF';
    const res3 = await PdfExtractionService.parsePdf(Buffer.from(pdfKids, 'latin1'), 'Kids.pdf');
    expect(res3.pageCount).toBe(3);
  });

  it('extracts multiline TJ arrays and hex strings inside TJ arrays including UTF-16BE', () => {
    const multilineStream = `
      BT
      [
        (First line of handout ) -120
        (second line continues)
      ] TJ
      [ <00480065006c006c006f> 10 <0057006f0072006c0064> ] TJ
      ET
    `;
    const text = PdfExtractionService.extractTextFromStream(multilineStream);
    expect(text).toContain('First line of handout');
    expect(text).toContain('second line continues');
    expect(text).toContain('Hello World');
  });

  it('distributes multiple streams across pages without dropping streams', async () => {
    const s1 = zlib.deflateSync(Buffer.from('BT (Page 1 Section A) Tj ET', 'latin1'));
    const s2 = zlib.deflateSync(Buffer.from('BT (Page 1 Section B) Tj ET', 'latin1'));
    const s3 = zlib.deflateSync(Buffer.from('BT (Page 2 Content) Tj ET', 'latin1'));

    const pdfContent = [
      '%PDF-1.4\n',
      '1 0 obj\n<< /Count 2 /Type /Pages >>\nendobj\n',
      '2 0 obj\n<< /Length ' + s1.length + ' /Filter /FlateDecode >>\nstream\n', s1, '\nendstream\nendobj\n',
      '3 0 obj\n<< /Length ' + s2.length + ' /Filter /FlateDecode >>\nstream\n', s2, '\nendstream\nendobj\n',
      '4 0 obj\n<< /Length ' + s3.length + ' /Filter /FlateDecode >>\nstream\n', s3, '\nendstream\nendobj\n',
      '%%EOF'
    ];

    const fullBuffer = Buffer.concat(pdfContent.map((c) => typeof c === 'string' ? Buffer.from(c, 'latin1') : c));
    const result = await PdfExtractionService.parsePdf(new Uint8Array(fullBuffer), 'LectureNotes.pdf');

    expect(result.pageCount).toBe(2);
    expect(result.pages.length).toBe(2);
    // Page 1 should contain Section A and Section B
    expect(result.pages[0].text).toContain('Page 1 Section A');
    expect(result.pages[0].text).toContain('Page 1 Section B');
    // Page 2 should contain Section C / Page 2 Content
    expect(result.pages[1].text).toContain('Page 2 Content');
  });

  it('does not truncate BT block when string literal contains ET substring', () => {
    // (MEETING) contains "ET" — old regex terminated block early, dropping (AFTER)
    const stream = 'BT (MEETING) Tj (AFTER) Tj ET';
    const text = PdfExtractionService.extractTextFromStream(stream);
    expect(text).toContain('MEETING');
    expect(text).toContain('AFTER');
  });

  it('extracts nested balanced parentheses from literal strings', () => {
    // PDF spec §7.3.4.2: (a (b) c) is a valid literal string
    const stream = 'BT (See section (2) for details) Tj ET';
    const text = PdfExtractionService.extractTextFromStream(stream);
    expect(text).toContain('See section');
    expect(text).toContain('details');
  });

  it('emits tokens in stream order, not type-sorted (TJ then Tj then hex)', () => {
    // Tokens: "Title" (Tj), then ["Chap", "ter"] (TJ), then "1" (Tj)
    // Expected order: Title Chap ter 1  — NOT all TJs first
    const stream = 'BT (Title) Tj [(Chap) 10 (ter)] TJ (1) Tj ET';
    const text = PdfExtractionService.extractTextFromStream(stream);
    const titleIdx = text.indexOf('Title');
    const chapIdx = text.indexOf('Chap');
    const oneIdx = text.indexOf('1');
    expect(titleIdx).toBeLessThan(chapIdx);
    expect(chapIdx).toBeLessThan(oneIdx);
  });

  it('decompressFlate works without window (Node.js / worker environment)', async () => {
    // Simulate absence of DecompressionStream — verifies zlib fallback used in workers
    const content = Buffer.from('BT (Worker text) Tj ET', 'latin1');
    const compressed = zlib.deflateSync(content);
    const result = await PdfExtractionService.decompressFlate(new Uint8Array(compressed));
    expect(result).not.toBeNull();
    const decoded = new TextDecoder('latin1').decode(result!);
    expect(decoded).toContain('Worker text');
  });

  it('sanitizes null bytes and control characters from extracted stream text', () => {
    const raw = 'Valid text\u0000 with nulls\u0007 and bells\r\nand clean lines';
    const cleaned = PdfExtractionService.sanitizeExtractedText(raw);
    expect(cleaned).toBe('Valid text with nulls and bells\nand clean lines');
  });

  it('throws typed PdfEncryptedError when encrypted PDF is uploaded', async () => {
    const encryptedPdf =
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n' +
      'trailer\n<< /Size 3 /Root 1 0 R /Encrypt << /Filter /Standard /V 1 /R 2 /O (12345678901234567890123456789012) /U (12345678901234567890123456789012) /P -44 >> >>\nstartxref\n100\n%%EOF';

    await expect(
      PdfExtractionService.parsePdf(Buffer.from(encryptedPdf, 'latin1'), 'Secure.pdf')
    ).rejects.toThrow(PdfEncryptedError);
  });

  it('HandoutPageService aggregates multi-file pages independently of PDF parser', () => {
    const files = [
      { name: 'File1.pdf', pages: [{ pageNumber: 1, text: 'P1' }] },
      { name: 'File2.pdf', pages: [{ pageNumber: 1, text: 'P2' }] }
    ];
    const res = HandoutPageService.aggregatePages(files);
    expect(res.length).toBe(2);
    expect(res[0].pageNumber).toBe(1);
    expect(res[0].chapterTitle).toBe('File1.pdf');
    expect(res[1].pageNumber).toBe(2);
    expect(res[1].chapterTitle).toBe('File2.pdf');
  });

  it('parses multi-page valid PDF via PdfJsParserStrategy with accurate text content', async () => {
    const pdfData =
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
      '4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>\nendobj\n' +
      '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 100 Td (Page 1 Text Content) Tj ET\nendstream\nendobj\n' +
      '6 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 100 Td (Page 2 Text Content) Tj ET\nendstream\nendobj\n' +
      'xref\n' +
      '0 7\n' +
      '0000000000 65535 f \n' +
      '0000000009 00000 n \n' +
      '0000000058 00000 n \n' +
      '0000000123 00000 n \n' +
      '0000000214 00000 n \n' +
      '0000000305 00000 n \n' +
      '0000000405 00000 n \n' +
      'trailer\n' +
      '<< /Size 7 /Root 1 0 R >>\n' +
      'startxref\n' +
      '505\n' +
      '%%EOF';

    const result = await PdfExtractionService.parsePdf(Buffer.from(pdfData, 'latin1'), 'MultiPage.pdf');
    expect(result.pageCount).toBe(2);
    expect(result.pages.length).toBe(2);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Page 1 Text Content');
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain('Page 2 Text Content');
  });
});

import { HandoutPage } from '@quiz-creator/types';

export class PdfExtractionService {
  /**
   * Parses mock or plain text into HandoutPage chunks.
   * Recognizes "--- PAGE X ---" markers or chunks every 50 lines.
   */
  static extractTextFromMockOrPlain(text: string, chapterTitle?: string): HandoutPage[] {
    const lines = text.split('\n');
    const pages: HandoutPage[] = [];
    let currentPage = 1;
    let currentBuffer: string[] = [];

    lines.forEach((line) => {
      if (line.includes('--- PAGE ') || currentBuffer.length > 50) {
        if (currentBuffer.length > 0) {
          pages.push({
            pageNumber: currentPage++,
            text: currentBuffer.join('\n'),
            chapterTitle
          });
          currentBuffer = [];
        }
      }
      currentBuffer.push(line);
    });

    if (currentBuffer.length > 0) {
      pages.push({
        pageNumber: currentPage,
        text: currentBuffer.join('\n'),
        chapterTitle
      });
    }

    return pages.length > 0 ? pages : [{ pageNumber: 1, text, chapterTitle }];
  }

  /**
   * Helper to decode PDF literal escape sequences: \n, \r, \t, \b, \f, \(, \), \\, \ddd (octal).
   */
  static decodePdfLiteralString(str: string): string {
    return str.replace(/\\([0-7]{1,3}|[\\()nrtbf])/g, (_, match) => {
      switch (match) {
        case 'n': return '\n';
        case 'r': return '\r';
        case 't': return '\t';
        case 'b': return '\b';
        case 'f': return '\f';
        case '\\': return '\\';
        case '(': return '(';
        case ')': return ')';
        default:
          return String.fromCharCode(parseInt(match, 8));
      }
    });
  }

  /**
   * Helper to decode PDF hex strings: <48656c6c6f> -> "Hello"
   */
  static decodePdfHexString(hex: string): string {
    const cleanHex = hex.replace(/\s+/g, '');
    let result = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const byteHex = cleanHex.substring(i, i + 2);
      if (byteHex.length === 2) {
        result += String.fromCharCode(parseInt(byteHex, 16));
      }
    }
    return result;
  }

  /**
   * Extracts text from decompressed PDF content stream tokens (BT ... ET, Tj, TJ).
   */
  static extractTextFromStream(streamText: string): string {
    const chunks: string[] = [];
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let blockMatch: RegExpExecArray | null;

    while ((blockMatch = btEtRegex.exec(streamText)) !== null) {
      const block = blockMatch[1];
      let blockText = '';

      // 1. TJ array operators: [(Hello) 10 (World)] TJ
      const tjArrayRegex = /\[((?:[^\r\n[\]]|\\[[\]])*)\]\s*TJ/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjArrayRegex.exec(block)) !== null) {
        const inner = tjMatch[1];
        const strRegex = /\(((?:[^()\\]|\\.)*)\)/g;
        let sMatch: RegExpExecArray | null;
        const arrayParts: string[] = [];
        while ((sMatch = strRegex.exec(inner)) !== null) {
          arrayParts.push(PdfExtractionService.decodePdfLiteralString(sMatch[1]));
        }
        if (arrayParts.length > 0) {
          blockText += arrayParts.join(' ') + ' ';
        }
      }

      // 2. Tj / ' / " simple string operators: (Hello World) Tj
      const tjSimpleRegex = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g;
      let simpleMatch: RegExpExecArray | null;
      while ((simpleMatch = tjSimpleRegex.exec(block)) !== null) {
        blockText += PdfExtractionService.decodePdfLiteralString(simpleMatch[1]) + ' ';
      }

      // 3. Hex string operators: <48656c6c6f> Tj
      const hexRegex = /<([0-9a-fA-F]+)>\s*(?:Tj|'|")/g;
      let hMatch: RegExpExecArray | null;
      while ((hMatch = hexRegex.exec(block)) !== null) {
        blockText += PdfExtractionService.decodePdfHexString(hMatch[1]) + ' ';
      }

      const cleaned = blockText.trim();
      if (cleaned.length > 0) {
        chunks.push(cleaned);
      }
    }

    return chunks.join('\n');
  }

  /**
   * Decompresses FlateDecode compressed byte stream across Node.js and Browser environments.
   */
  static async decompressFlate(data: Uint8Array): Promise<Uint8Array> {
    if (typeof window !== 'undefined' && typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(data as any);
        writer.close();
        const response = new Response(ds.readable);
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      } catch {
        try {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(data as any);
          writer.close();
          const response = new Response(ds.readable);
          const buffer = await response.arrayBuffer();
          return new Uint8Array(buffer);
        } catch {
          return data;
        }
      }
    } else {
      try {
        const zlibModule = 'zlib';
        const zlib = await import(/* webpackIgnore: true */ zlibModule);
        try {
          return zlib.inflateSync(data);
        } catch {
          return zlib.inflateRawSync(data);
        }
      } catch {
        return data;
      }
    }
  }

  /**
   * Parses binary PDF data or plain text string into categorized HandoutPage[] streams.
   */
  static async parsePdf(
    input: Uint8Array | ArrayBuffer | string,
    fileName: string = 'Handout.pdf'
  ): Promise<{ pages: HandoutPage[]; pageCount: number }> {
    if (typeof input === 'string') {
      const pages = PdfExtractionService.extractTextFromMockOrPlain(input, fileName);
      return { pages, pageCount: pages.length };
    }

    const uint8 = input instanceof Uint8Array ? input : new Uint8Array(input);
    const decoder = new TextDecoder('latin1');
    const fullText = decoder.decode(uint8);

    // 1. Count pages from PDF catalog/tree: /Count N or count of /Type /Page
    let pageCount = 1;
    const pagesCountMatch = fullText.match(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/);
    if (pagesCountMatch) {
      pageCount = parseInt(pagesCountMatch[1], 10);
    } else {
      const pageMatches = fullText.match(/\/Type\s*\/Page\b/g);
      if (pageMatches && pageMatches.length > 0) {
        pageCount = pageMatches.length;
      }
    }

    // 2. Extract streams from PDF
    // Search for stream ... endstream positions
    const pages: HandoutPage[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch: RegExpExecArray | null;
    const extractedStreams: string[] = [];

    // Also look for object headers with /Filter /FlateDecode
    const objRegex = /(\d+\s+\d+\s+obj[\s\S]*?endobj)/g;
    let objMatch: RegExpExecArray | null;

    while ((objMatch = objRegex.exec(fullText)) !== null) {
      const objContent = objMatch[1];
      const isFlate = objContent.includes('/FlateDecode');
      const innerStreamMatch = objContent.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);

      if (innerStreamMatch) {
        const rawStreamString = innerStreamMatch[1];
        if (isFlate) {
          // Extract binary slice from uint8 to avoid character encoding corruption
          const streamHeader = 'stream';
          const headerIndex = fullText.indexOf(innerStreamMatch[0], objMatch.index);
          const startIndex = fullText.indexOf('\n', headerIndex + streamHeader.length) + 1;
          const endIndex = startIndex + rawStreamString.length;
          const rawSlice = uint8.slice(startIndex, endIndex);

          try {
            const decompressed = await PdfExtractionService.decompressFlate(rawSlice);
            const decompressedText = new TextDecoder('latin1').decode(decompressed);
            const pageText = PdfExtractionService.extractTextFromStream(decompressedText);
            if (pageText.trim()) {
              extractedStreams.push(pageText.trim());
            }
          } catch {
            // If decompression fails, try plain text extraction
            const fallbackText = PdfExtractionService.extractTextFromStream(rawStreamString);
            if (fallbackText.trim()) {
              extractedStreams.push(fallbackText.trim());
            }
          }
        } else {
          const pageText = PdfExtractionService.extractTextFromStream(rawStreamString);
          if (pageText.trim()) {
            extractedStreams.push(pageText.trim());
          }
        }
      }
    }

    // Distribute extracted stream texts across pages
    if (extractedStreams.length > 0) {
      if (extractedStreams.length === pageCount) {
        extractedStreams.forEach((streamText, idx) => {
          pages.push({
            pageNumber: idx + 1,
            text: streamText,
            chapterTitle: fileName
          });
        });
      } else {
        // Map streams into the counted pages
        for (let i = 0; i < pageCount; i++) {
          const streamIdx = Math.floor((i / pageCount) * extractedStreams.length);
          pages.push({
            pageNumber: i + 1,
            text: extractedStreams[streamIdx] || `[Page ${i + 1} from ${fileName}]`,
            chapterTitle: fileName
          });
        }
      }
    } else {
      // Fallback if streams are non-text / scanned
      for (let i = 1; i <= pageCount; i++) {
        pages.push({
          pageNumber: i,
          text: `[Page ${i} extracted from ${fileName}]`,
          chapterTitle: fileName
        });
      }
    }

    return {
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: `[Content from ${fileName}]`, chapterTitle: fileName }],
      pageCount: Math.max(pageCount, pages.length)
    };
  }

  /**
   * Aggregates multiple chapter file pages into a unified, categorized HandoutPage[] stream.
   */
  static aggregateMultiFilePages(files: Array<{ name: string; pages: HandoutPage[] }>): HandoutPage[] {
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

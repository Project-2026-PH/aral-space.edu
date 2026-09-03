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
   * Strips binary null bytes and non-printable control characters from extracted stream text.
   */
  static sanitizeExtractedText(text: string): string {
    return text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
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

    // Check for 2-byte UTF-16BE encoding (starts with FEFF, or every even byte is 00 for standard ASCII)
    if (cleanHex.length >= 4 && cleanHex.length % 4 === 0) {
      const lower = cleanHex.toLowerCase();
      const hasBOM = lower.startsWith('feff');
      const isUtf16Ascii = cleanHex.length >= 8 && cleanHex.substring(0, 2) === '00' && cleanHex.substring(4, 6) === '00';
      if (hasBOM || isUtf16Ascii) {
        const start = hasBOM ? 4 : 0;
        for (let i = start; i < cleanHex.length; i += 4) {
          const code = parseInt(cleanHex.substring(i, i + 4), 16);
          if (!isNaN(code) && code > 0) {
            result += String.fromCharCode(code);
          }
        }
        if (result.trim().length > 0) return result;
        result = '';
      }
    }

    for (let i = 0; i < cleanHex.length; i += 2) {
      const byteHex = cleanHex.substring(i, i + 2);
      if (byteHex.length === 2) {
        const code = parseInt(byteHex, 16);
        if (code !== 0) {
          result += String.fromCharCode(code);
        }
      }
    }
    return result;
  }

  /**
   * Extracts text from decompressed PDF content stream tokens (BT ... ET, Tj, TJ).
   * Sequential scanner ensures token ordering, balanced nested parentheses, and content-independent BT/ET boundaries.
   */
  static extractTextFromStream(streamText: string): string {
    const chunks: string[] = [];
    let currentBlock = '';
    let inBT = false;
    let lastString: string | null = null;
    let lastArrayStrings: string[] | null = null;

    let i = 0;
    const len = streamText.length;

    while (i < len) {
      const ch = streamText[i];

      // 1. Skip whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        i++;
        continue;
      }

      // 2. Skip comments
      if (ch === '%') {
        while (i < len && streamText[i] !== '\r' && streamText[i] !== '\n') {
          i++;
        }
        continue;
      }

      // 3. Literal string: ( ... ) with nested balanced parens
      if (ch === '(') {
        let depth = 1;
        let j = i + 1;
        let escaped = false;
        while (j < len && depth > 0) {
          const c = streamText[j];
          if (escaped) {
            escaped = false;
          } else if (c === '\\') {
            escaped = true;
          } else if (c === '(') {
            depth++;
          } else if (c === ')') {
            depth--;
          }
          j++;
        }
        const literalContent = streamText.slice(i + 1, depth === 0 ? j - 1 : j);
        lastString = PdfExtractionService.decodePdfLiteralString(literalContent);
        i = j;
        continue;
      }

      // 4. Hex string: < ... > (check not << dictionary)
      if (ch === '<') {
        if (i + 1 < len && streamText[i + 1] === '<') {
          i += 2;
          continue;
        }
        const closeIdx = streamText.indexOf('>', i + 1);
        if (closeIdx !== -1) {
          const hexContent = streamText.slice(i + 1, closeIdx);
          lastString = PdfExtractionService.decodePdfHexString(hexContent);
          i = closeIdx + 1;
          continue;
        }
      }

      // 5. Array: [ ... ] for TJ operator
      if (ch === '[') {
        let j = i + 1;
        const arrayStrings: string[] = [];
        while (j < len && streamText[j] !== ']') {
          const ac = streamText[j];
          if (ac === '(') {
            let depth = 1;
            let k = j + 1;
            let escaped = false;
            while (k < len && depth > 0) {
              const kc = streamText[k];
              if (escaped) {
                escaped = false;
              } else if (kc === '\\') {
                escaped = true;
              } else if (kc === '(') {
                depth++;
              } else if (kc === ')') {
                depth--;
              }
              k++;
            }
            const innerStr = streamText.slice(j + 1, depth === 0 ? k - 1 : k);
            const decoded = PdfExtractionService.decodePdfLiteralString(innerStr);
            if (decoded) arrayStrings.push(decoded);
            j = k;
            continue;
          } else if (ac === '<') {
            if (j + 1 < len && streamText[j + 1] === '<') {
              j += 2;
              continue;
            } 
            const closeIdx = streamText.indexOf('>', j + 1);
            if (closeIdx !== -1) {
              const hexStr = streamText.slice(j + 1, closeIdx);
              const decoded = PdfExtractionService.decodePdfHexString(hexStr);
              if (decoded) arrayStrings.push(decoded);
              j = closeIdx + 1;
              continue;
            }
          }
          j++;
        }
        lastArrayStrings = arrayStrings;
        i = j < len ? j + 1 : len;
        continue;
      }

      // 6. Keywords and operators
      let j = i;
      while (
        j < len &&
        streamText[j] !== ' ' &&
        streamText[j] !== '\t' &&
        streamText[j] !== '\r' &&
        streamText[j] !== '\n' &&
        streamText[j] !== '(' &&
        streamText[j] !== ')' &&
        streamText[j] !== '<' &&
        streamText[j] !== '>' &&
        streamText[j] !== '[' &&
        streamText[j] !== ']' &&
        streamText[j] !== '%' &&
        streamText[j] !== '/'
      ) {
        j++;
      }

      if (j === i) {
        i++;
        continue;
      }

      const token = streamText.slice(i, j);
      i = j;

      if (token === 'BT') {
        inBT = true;
        currentBlock = '';
        lastString = null;
        lastArrayStrings = null;
      } else if (token === 'ET') {
        if (inBT) {
          inBT = false;
          const trimmed = currentBlock.trim();
          if (trimmed.length > 0) {
            chunks.push(trimmed);
          }
          currentBlock = '';
        }
      } else if (token === 'Tj' || token === "'" || token === '"') {
        if (lastString !== null) {
          currentBlock += (currentBlock && !currentBlock.endsWith(' ') ? ' ' : '') + lastString;
          lastString = null;
        }
      } else if (token === 'TJ') {
        if (lastArrayStrings !== null && lastArrayStrings.length > 0) {
          let combined = '';
          for (const part of lastArrayStrings) {
            if (!combined) {
              combined = part;
            } else if (combined.endsWith(' ') || part.startsWith(' ')) {
              combined += part;
            } else {
              combined += ' ' + part;
            }
          }
          if (combined) {
            currentBlock += (currentBlock && !currentBlock.endsWith(' ') ? ' ' : '') + combined;
          }
          lastArrayStrings = null;
        }
      }
    }

    if (currentBlock.trim().length > 0) {
      chunks.push(currentBlock.trim());
    }

    // Fallback: if no BT...ET blocks were found (malformed stream), search for all literal strings
    if (chunks.length === 0) {
      const fallbackStrings: string[] = [];
      const litRegex = /\(((?:[^()\\]|\\.)*)\)/g;
      let m: RegExpExecArray | null;
      while ((m = litRegex.exec(streamText)) !== null) {
        const decoded = PdfExtractionService.decodePdfLiteralString(m[1]).trim();
        if (decoded) fallbackStrings.push(decoded);
      }
      if (fallbackStrings.length > 0) {
        chunks.push(fallbackStrings.join(' '));
      }
    }

    return PdfExtractionService.sanitizeExtractedText(chunks.join('\n'));
  }

  /**
   * Decompresses FlateDecode compressed byte stream across Node.js and Browser environments.
   * Uses pipeThrough in browser to guarantee zero unhandled promise rejections.
   */
  static async decompressFlate(data: Uint8Array): Promise<Uint8Array | null> {
    if (!data || data.length === 0) return null;

    if (typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined' && typeof Blob !== 'undefined') {
      const tryDecompress = async (bytes: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array | null> => {
        try {
          const ds = new DecompressionStream(format);
          const blob = new Blob([bytes as unknown as BlobPart]);
          const stream = blob.stream().pipeThrough(ds);
          const response = new Response(stream);
          const buffer = await response.arrayBuffer();
          return new Uint8Array(buffer);
        } catch {
          return null;
        }
      };

      // 1. Direct standard zlib decompression
      let result = await tryDecompress(data, 'deflate');
      if (result) return result;

      // 2. If data starts with zlib header (0x78), try raw deflate by stripping 2-byte header (and optional 4-byte checksum)
      if (data[0] === 0x78) {
        result = await tryDecompress(data.slice(2), 'deflate-raw');
        if (result) return result;
        if (data.length >= 6) {
          result = await tryDecompress(data.slice(2, -4), 'deflate-raw');
          if (result) return result;
        }
      }

      // 3. Try raw deflate on unstripped data
      result = await tryDecompress(data, 'deflate-raw');
      if (result) return result;

      // 4. Try offset zlib header if stray leading byte exists
      if (data.length > 2) {
        if (data[1] === 0x78) {
          result = await tryDecompress(data.slice(1), 'deflate');
          if (result) return result;
        } else if (data[2] === 0x78) {
          result = await tryDecompress(data.slice(2), 'deflate');
          if (result) return result;
        }
      }
    }

    // Fallback: Node.js zlib module when DecompressionStream is missing or for Node.js environments
    try {
      const zlibModule = 'zlib';
      const zlib = await import(/* webpackIgnore: true */ zlibModule);
      try {
        return zlib.inflateSync(data);
      } catch {
        try {
          return zlib.inflateRawSync(data);
        } catch {
          return null;
        }
      }
    } catch {
      return null;
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

    // Initial page count from PDF catalog/tree: /Count N, /Kids, /Parent, or /Type /Page
    let pageCount = 1;

    // A. Check all /Count N in the document (the root /Pages node defines the total page count)
    const allCounts = Array.from(fullText.matchAll(/\/Count\s+(\d+)/g));
    for (const m of allCounts) {
      const c = parseInt(m[1], 10);
      if (c > 0 && c <= 2000) {
        pageCount = Math.max(pageCount, c);
      }
    }

    // B. Check /Linearized dictionary: /N <count>
    const linearizedMatch = fullText.match(/\/Linearized\b[\s\S]*?\/N\s+(\d+)/);
    if (linearizedMatch) {
      pageCount = Math.max(pageCount, parseInt(linearizedMatch[1], 10));
    }

    // C. Check /Kids [ ... ] in /Pages dictionary
    const kidsRegex = /\/Kids\s*\[([\s\S]*?)\]/g;
    let km: RegExpExecArray | null;
    while ((km = kidsRegex.exec(fullText)) !== null) {
      const kidRefs = km[1].match(/\d+\s+\d+\s+R/g);
      if (kidRefs && kidRefs.length > 0) {
        pageCount = Math.max(pageCount, kidRefs.length);
      }
    }

    // D. Count uncompressed /Type /Page objects
    const pageMatches = fullText.match(/\/Type\s*\/\s*Page\b(?!\s*s)/g);
    if (pageMatches && pageMatches.length > 0) {
      pageCount = Math.max(pageCount, pageMatches.length);
    }

    // E. Count /Parent references (each page object references its parent /Pages node)
    const parentMatches = fullText.match(/\/Parent\s+\d+\s+\d+\s+R/g);
    if (parentMatches && parentMatches.length > 0) {
      pageCount = Math.max(pageCount, parentMatches.length);
    }

    console.log(`[PdfExtractionService] Parsing "${fileName}" (${uint8.length} bytes): initial pageCount = ${pageCount} (Counts found: ${allCounts.map(m => m[1]).join(', ') || 'none'}, /Type/Page: ${pageMatches?.length || 0}, /Parent: ${parentMatches?.length || 0})`);

    // Scan and extract streams from PDF
    const pages: HandoutPage[] = [];
    const extractedStreams: string[] = [];

    let searchPos = 0;
    while (searchPos < fullText.length) {
      const streamIdx = fullText.indexOf('stream', searchPos);
      if (streamIdx === -1) break;

      // Verify boundary so 'stream' is a keyword and not 'endstream' or mid-word
      if (streamIdx >= 3 && fullText.slice(streamIdx - 3, streamIdx) === 'end') {
        searchPos = streamIdx + 6;
        continue;
      }
      const prevChar = streamIdx > 0 ? fullText[streamIdx - 1] : ' ';
      if (prevChar !== '\n' && prevChar !== '\r' && prevChar !== ' ' && prevChar !== '\t' && prevChar !== '>') {
        searchPos = streamIdx + 6;
        continue;
      }

      // Find the dictionary << ... >> directly preceding this stream (balance << and >> backwards)
      const dictEnd = fullText.lastIndexOf('>>', streamIdx);
      let streamDict = '';
      if (dictEnd !== -1 && streamIdx - dictEnd < 100) {
        let depth = 0;
        for (let i = dictEnd; i >= 0 && dictEnd - i < 4000; i--) {
          if (fullText[i] === '>' && i > 0 && fullText[i - 1] === '>') {
            depth++;
            i--;
          } else if (fullText[i] === '<' && i > 0 && fullText[i - 1] === '<') {
            depth--;
            i--;
            if (depth === 0) {
              streamDict = fullText.slice(i, dictEnd + 2);
              break;
            }
          }
        }
      }
      if (!streamDict) {
        streamDict = fullText.slice(Math.max(0, streamIdx - 1000), streamIdx);
      }

      // Read dictionary flags for THIS specific stream
      const isImage = /\/Subtype\s*\/Image\b/.test(streamDict);
      const isXRef = /\/Type\s*\/XRef\b/.test(streamDict);
      const isFont = /\/FontFile[123]?\b|\/Subtype\s*\/(?:Type1C|CIDFontType0C|OpenType)/.test(streamDict);
      const isObjStm = /\/Type\s*\/ObjStm\b|\/ObjStm\b/.test(streamDict);
      const isFlate = /\/FlateDecode\b|\/Fl\b/.test(streamDict);

      // Advance past 'stream' keyword and any trailing whitespace/newlines to the binary start
      let streamStart = streamIdx + 6;
      while (streamStart < uint8.length && (uint8[streamStart] === 0x20 || uint8[streamStart] === 0x09)) {
        streamStart++;
      }
      if (streamStart + 1 < uint8.length && uint8[streamStart] === 0x0D && uint8[streamStart + 1] === 0x0A) {
        streamStart += 2;
      } else if (streamStart < uint8.length && (uint8[streamStart] === 0x0A || uint8[streamStart] === 0x0D)) {
        streamStart += 1;
      }

      // If Flate stream, advance up to 4 bytes if needed to find zlib header 0x78
      if (isFlate && streamStart < uint8.length && uint8[streamStart] !== 0x78) {
        for (let off = 0; off < 4 && streamStart + off < uint8.length; off++) {
          if (uint8[streamStart + off] === 0x78) {
            streamStart += off;
            break;
          }
        }
      }

      // Determine stream length
      let streamEnd = -1;
      const lengthMatch = streamDict.match(/\/Length\s+(\d+)/);
      if (lengthMatch) {
        const streamLength = parseInt(lengthMatch[1], 10);
        if (streamLength > 0 && streamStart + streamLength <= uint8.length) {
          streamEnd = streamStart + streamLength;
        }
      }

      // If indirect length reference (e.g. /Length 12 0 R)
      if (streamEnd === -1) {
        const indirectMatch = streamDict.match(/\/Length\s+(\d+)\s+\d+\s+R/);
        if (indirectMatch) {
          const refObjNum = indirectMatch[1];
          const objRefMatch = fullText.match(new RegExp(`\\b${refObjNum}\\s+\\d+\\s+obj\\s*(\\d+)\\s*endobj`));
          if (objRefMatch) {
            const streamLength = parseInt(objRefMatch[1], 10);
            if (streamLength > 0 && streamStart + streamLength <= uint8.length) {
              streamEnd = streamStart + streamLength;
            }
          }
        }
      }

      // Fallback: search for endstream
      if (streamEnd === -1) {
        const endstreamIdx = fullText.indexOf('endstream', streamStart);
        if (endstreamIdx !== -1) {
          streamEnd = endstreamIdx;
          if (streamEnd > streamStart && fullText[streamEnd - 1] === '\n') streamEnd--;
          if (streamEnd > streamStart && fullText[streamEnd - 1] === '\r') streamEnd--;
        } else {
          searchPos = streamIdx + 6;
          continue;
        }
      }

      // Next search starts immediately after this stream's end
      searchPos = Math.max(streamStart + 1, streamEnd + 1);

      // Skip non-text content streams (images, fonts)
      if (isImage || isFont) {
        continue;
      }

      const rawSlice = uint8.slice(streamStart, streamEnd);
      if (rawSlice.length === 0) continue;

      if (isFlate) {
        try {
          const decompressed = await PdfExtractionService.decompressFlate(rawSlice);
          if (decompressed) {
            const decompressedText = new TextDecoder('latin1').decode(decompressed);
            if (isXRef || isObjStm) {
              // Inspect compressed XRef/ObjStm for page count metadata
              const streamCounts = Array.from(decompressedText.matchAll(/\/Count\s+(\d+)/g));
              for (const sc of streamCounts) {
                const c = parseInt(sc[1], 10);
                if (c > 0 && c <= 2000) {
                  pageCount = Math.max(pageCount, c);
                }
              }
              const objPageMatches = decompressedText.match(/\/Type\s*\/\s*Page\b(?!\s*s)/g);
              if (objPageMatches && objPageMatches.length > 0) {
                pageCount = Math.max(pageCount, objPageMatches.length);
              }
              const objParentMatches = decompressedText.match(/\/Parent\s+\d+\s+\d+\s+R/g);
              if (objParentMatches && objParentMatches.length > 0) {
                pageCount = Math.max(pageCount, objParentMatches.length);
              }
              console.log(`[PdfExtractionService] Decoded /${isXRef ? 'XRef' : 'ObjStm'}: updated pageCount = ${pageCount} (Pages: ${objPageMatches?.length || 0}, Counts: ${streamCounts.map(s => s[1]).join(', ') || 'none'})`);
            } else {
              const pageText = PdfExtractionService.extractTextFromStream(decompressedText);
              if (pageText.trim()) {
                extractedStreams.push(pageText.trim());
              }
            }
          }
        } catch (err: any) {
          console.warn(`[PdfExtractionService] Stream decompression at ${streamIdx} failed:`, err.message);
        }
      } else {
        const rawStreamString = fullText.slice(streamStart, streamEnd);
        const pageText = PdfExtractionService.extractTextFromStream(rawStreamString);
        if (pageText.trim()) {
          extractedStreams.push(pageText.trim());
        }
      }
    }

    // Inspect extracted streams for internal page breaks (\f or "Page X" or numbered sections)
    const splitStreams: string[] = [];
    for (const st of extractedStreams) {
      const parts = st.split(/\f|\n\s*(?:[-—–]?\s*Page\s+\d+\s*(?:of\s+\d+)?\s*[-—–]?|[-—–]\s*\d+\s*[-—–])\s*\n/gi)
        .map(p => p.trim())
        .filter(p => p.length > 20);
      if (parts.length > 1) {
        splitStreams.push(...parts);
      } else {
        splitStreams.push(st);
      }
    }
    if (splitStreams.length > extractedStreams.length) {
      extractedStreams.length = 0;
      extractedStreams.push(...splitStreams);
    }

    // Fallback: check whole document for uncompressed text blocks if no stream text was extracted
    if (extractedStreams.length === 0) {
      const wholeDocText = PdfExtractionService.extractTextFromStream(fullText);
      if (wholeDocText.trim()) {
        extractedStreams.push(wholeDocText.trim());
      }
    }

    // Distribute extracted stream texts across pages.
    // Strategy: join all streams (preserving order) then partition into exactly pageCount pages.
    // This avoids the strict-equality trap where an extra metadata stream silently bucketed content.
    if (extractedStreams.length > 0) {
      if (extractedStreams.length === pageCount) {
        // Happy path: one stream per page — direct 1:1 assignment.
        extractedStreams.forEach((streamText, idx) => {
          pages.push({
            pageNumber: idx + 1,
            text: streamText,
            chapterTitle: fileName
          });
        });
      } else {
        // Combined path handles both more-streams-than-pages and fewer-streams-than-pages.
        // Join all content, attempt explicit page splits, then fall back to line distribution.
        const combinedText = extractedStreams.join('\n\n');
        const ffPages = combinedText
          .split(/\f|\n---\s*PAGE\s*\d+\s*---\n/i)
          .map(p => p.trim())
          .filter(p => p.length > 0);

        if (ffPages.length >= pageCount) {
          // Enough explicit splits: use them.
          for (let i = 0; i < pageCount; i++) {
            pages.push({
              pageNumber: i + 1,
              text: ffPages[i] || `[Page ${i + 1} from ${fileName}]`,
              chapterTitle: fileName
            });
          }
        } else if (extractedStreams.length > pageCount) {
          // More streams than declared pages: bucket proportionally.
          for (let i = 0; i < pageCount; i++) {
            const startIdx = Math.floor((i / pageCount) * extractedStreams.length);
            const endIdx = Math.floor(((i + 1) / pageCount) * extractedStreams.length);
            const sliceStreams = extractedStreams.slice(startIdx, Math.max(startIdx + 1, endIdx));
            pages.push({
              pageNumber: i + 1,
              text: sliceStreams.join('\n\n'),
              chapterTitle: fileName
            });
          }
        } else {
          // Fewer streams than declared pages: distribute by line count.
          const lines = combinedText.split('\n');
          const linesPerPage = Math.max(1, Math.ceil(lines.length / pageCount));
          for (let i = 0; i < pageCount; i++) {
            const pageLines = lines.slice(i * linesPerPage, (i + 1) * linesPerPage).join('\n');
            pages.push({
              pageNumber: i + 1,
              text: pageLines.trim() || `[Page ${i + 1} from ${fileName}]`,
              chapterTitle: fileName
            });
          }
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

    console.log(`[PdfExtractionService] "${fileName}" extraction complete: ${extractedStreams.length} stream chunks extracted. Outputting ${pages.length} pages (Page 1 text length: ${pages[0]?.text?.length || 0} chars).`);

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

import { HandoutPage } from '@quiz-creator/types';
import { IPdfParserStrategy, PdfParseResult } from './IPdfParserStrategy';
import { PdfEncryptedError } from '../errors/PdfEncryptedError';
import { PdfFlateDecompressor } from '../decoders/PdfFlateDecompressor';
import { PdfStreamTextExtractor } from '../decoders/PdfStreamTextExtractor';

/**
 * Fallback PDF parser strategy using stream scanning and zlib decompression.
 * Used for synthetic test buffers or malformed stream fragments that lack
 * standard xref tables or trailers.
 */
export class StreamScannerParserStrategy implements IPdfParserStrategy {
  readonly name = 'stream-scanner';

  async parse(data: Uint8Array, fileName: string): Promise<PdfParseResult> {
    const decoder = new TextDecoder('latin1');
    const fullText = decoder.decode(data);

    // Fail-fast guard: Hand-rolled stream parser cannot decrypt RC4/AES encrypted streams
    if (/\/Encrypt\b/.test(fullText)) {
      throw new PdfEncryptedError(
        fileName,
        false,
        `PDF "${fileName}" is encrypted. Hand-rolled parser cannot decrypt streams; please supply an unencrypted PDF or migrate to PDF.js.`
      );
    }

    // Initial page count heuristics from PDF catalog / tree
    let pageCount = 1;
    let hasExplicitPageCount = false;

    // A. All /Count N in document
    const allCounts = Array.from(fullText.matchAll(/\/Count\s+(\d+)/g));
    for (const m of allCounts) {
      const c = parseInt(m[1], 10);
      if (c > 0 && c <= 2000) {
        pageCount = Math.max(pageCount, c);
        hasExplicitPageCount = true;
      }
    }

    // B. /Linearized dictionary: /N <count>
    const linearizedMatch = fullText.match(/\/Linearized\b[\s\S]*?\/N\s+(\d+)/);
    if (linearizedMatch) {
      pageCount = Math.max(pageCount, parseInt(linearizedMatch[1], 10));
      hasExplicitPageCount = true;
    }

    // C. /Kids [ ... ] in /Pages dictionary
    const kidsRegex = /\/Kids\s*\[([\s\S]*?)\]/g;
    let km: RegExpExecArray | null;
    while ((km = kidsRegex.exec(fullText)) !== null) {
      const kidRefs = km[1].match(/\d+\s+\d+\s+R/g);
      if (kidRefs && kidRefs.length > 0) {
        pageCount = Math.max(pageCount, kidRefs.length);
        hasExplicitPageCount = true;
      }
    }

    // D. Count uncompressed /Type /Page objects
    const pageMatches = fullText.match(/\/Type\s*\/\s*Page\b(?!\s*s)/g);
    if (pageMatches && pageMatches.length > 0) {
      pageCount = Math.max(pageCount, pageMatches.length);
      hasExplicitPageCount = true;
    }

    // E. Count /Parent references
    const parentMatches = fullText.match(/\/Parent\s+\d+\s+\d+\s+R/g);
    if (parentMatches && parentMatches.length > 0) {
      pageCount = Math.max(pageCount, parentMatches.length);
      hasExplicitPageCount = true;
    }

    console.log(
      `[PdfExtractionService] Parsing "${fileName}" (${data.length} bytes): initial pageCount = ${pageCount} ` +
        `(Counts found: ${allCounts.map((m) => m[1]).join(', ') || 'none'}, /Type/Page: ${pageMatches?.length || 0}, /Parent: ${parentMatches?.length || 0})`
    );

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
        for (let i = dictEnd + 1; i >= 1 && (dictEnd + 1) - i < 4000; i--) {
          if (fullText[i] === '>' && fullText[i - 1] === '>') {
            depth++;
            i--;
          } else if (fullText[i] === '<' && fullText[i - 1] === '<') {
            depth--;
            if (depth === 0) {
              streamDict = fullText.slice(i - 1, dictEnd + 2);
              break;
            }
            i--;
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
      while (streamStart < data.length && (data[streamStart] === 0x20 || data[streamStart] === 0x09)) {
        streamStart++;
      }
      if (streamStart + 1 < data.length && data[streamStart] === 0x0d && data[streamStart + 1] === 0x0a) {
        streamStart += 2;
      } else if (streamStart < data.length && (data[streamStart] === 0x0a || data[streamStart] === 0x0d)) {
        streamStart += 1;
      }

      // If Flate stream, advance up to 4 bytes if needed to find zlib header 0x78
      if (isFlate && streamStart < data.length && data[streamStart] !== 0x78) {
        for (let off = 0; off < 4 && streamStart + off < data.length; off++) {
          if (data[streamStart + off] === 0x78) {
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
        if (streamLength > 0 && streamStart + streamLength <= data.length) {
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
            if (streamLength > 0 && streamStart + streamLength <= data.length) {
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

      const rawSlice = data.slice(streamStart, streamEnd);
      if (rawSlice.length === 0) continue;

      if (isFlate) {
        try {
          const decompressed = await PdfFlateDecompressor.decompress(rawSlice);
          if (decompressed) {
            const decompressedText = new TextDecoder('latin1').decode(decompressed);
            if (isXRef || isObjStm) {
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
            } else {
              const pageText = PdfStreamTextExtractor.extractTextFromStream(decompressedText);
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
        const pageText = PdfStreamTextExtractor.extractTextFromStream(rawStreamString);
        if (pageText.trim()) {
          extractedStreams.push(pageText.trim());
        }
      }
    }

    // Inspect extracted streams for internal form-feed or page markers
    const splitStreams: string[] = [];
    for (const st of extractedStreams) {
      const parts = st
        .split(/\f|\n\s*(?:[-—–]?\s*Page\s+\d+\s*(?:of\s+\d+)?\s*[-—–]?|[-—–]\s*\d+\s*[-—–])\s*\n/gi)
        .map((p) => p.trim())
        .filter((p) => p.length > 20);
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
      const wholeDocText = PdfStreamTextExtractor.extractTextFromStream(fullText);
      if (wholeDocText.trim()) {
        extractedStreams.push(wholeDocText.trim());
      }
    }

    // Uncap page count from stream discovery when no explicit count was declared (Issue #10 Root Cause 4)
    if (!hasExplicitPageCount && extractedStreams.length > 0) {
      pageCount = extractedStreams.length;
    }

    // Distribute extracted stream texts across pages
    if (extractedStreams.length > 0) {
      if (extractedStreams.length === pageCount) {
        extractedStreams.forEach((streamText, idx) => {
          pages.push({
            pageNumber: idx + 1,
            text: streamText,
            chapterTitle: fileName,
          });
        });
      } else {
        const combinedText = extractedStreams.join('\n\n');
        const ffPages = combinedText
          .split(/\f|\n---\s*PAGE\s*\d+\s*---\n/i)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        if (ffPages.length >= pageCount) {
          for (let i = 0; i < pageCount; i++) {
            pages.push({
              pageNumber: i + 1,
              text: ffPages[i] || `[Page ${i + 1} from ${fileName}]`,
              chapterTitle: fileName,
            });
          }
        } else if (extractedStreams.length > pageCount) {
          // Proportionally bucket streams without dropping intermediate streams
          for (let i = 0; i < pageCount; i++) {
            const startIdx = Math.round((i / pageCount) * extractedStreams.length);
            const endIdx = Math.round(((i + 1) / pageCount) * extractedStreams.length);
            const sliceStreams = extractedStreams.slice(startIdx, Math.max(startIdx + 1, endIdx));
            pages.push({
              pageNumber: i + 1,
              text: sliceStreams.join('\n\n'),
              chapterTitle: fileName,
            });
          }
        } else {
          // Distribute by line count
          const lines = combinedText.split('\n');
          const linesPerPage = Math.max(1, Math.ceil(lines.length / pageCount));
          for (let i = 0; i < pageCount; i++) {
            const pageLines = lines.slice(i * linesPerPage, (i + 1) * linesPerPage).join('\n');
            pages.push({
              pageNumber: i + 1,
              text: pageLines.trim() || `[Page ${i + 1} from ${fileName}]`,
              chapterTitle: fileName,
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
          chapterTitle: fileName,
        });
      }
    }

    console.log(
      `[PdfExtractionService] "${fileName}" extraction complete: ${extractedStreams.length} stream chunks extracted. ` +
        `Outputting ${pages.length} pages (Page 1 text length: ${pages[0]?.text?.length || 0} chars).`
    );

    return {
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: `[Content from ${fileName}]`, chapterTitle: fileName }],
      pageCount: Math.max(pageCount, pages.length),
    };
  }
}

import { PdfLiteralDecoder } from './PdfLiteralDecoder';
import { PdfHexDecoder } from './PdfHexDecoder';

/**
 * Extracts text from decompressed PDF content stream tokens (BT ... ET, Tj, TJ).
 * Sequential scanner ensures token ordering, balanced nested parentheses, and content-independent BT/ET boundaries.
 */
export class PdfStreamTextExtractor {
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
   * Extracts text from decompressed stream tokens.
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

      // Skip whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        i++;
        continue;
      }

      // Skip comments
      if (ch === '%') {
        while (i < len && streamText[i] !== '\r' && streamText[i] !== '\n') {
          i++;
        }
        continue;
      }

      // Literal string: ( ... ) with nested balanced parens
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
        lastString = PdfLiteralDecoder.decode(literalContent);
        i = j;
        continue;
      }

      // Hex string: < ... > (check not << dictionary)
      if (ch === '<') {
        if (i + 1 < len && streamText[i + 1] === '<') {
          i += 2;
          continue;
        }
        const closeIdx = streamText.indexOf('>', i + 1);
        if (closeIdx !== -1) {
          const hexContent = streamText.slice(i + 1, closeIdx);
          lastString = PdfHexDecoder.decode(hexContent);
          i = closeIdx + 1;
          continue;
        }
      }

      // Array: [ ... ] for TJ operator
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
            const decoded = PdfLiteralDecoder.decode(innerStr);
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
              const decoded = PdfHexDecoder.decode(hexStr);
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

      // Keywords and operators
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
        const decoded = PdfLiteralDecoder.decode(m[1]).trim();
        if (decoded) fallbackStrings.push(decoded);
      }
      if (fallbackStrings.length > 0) {
        chunks.push(fallbackStrings.join(' '));
      }
    }

    return PdfStreamTextExtractor.sanitizeExtractedText(chunks.join('\n'));
  }
}

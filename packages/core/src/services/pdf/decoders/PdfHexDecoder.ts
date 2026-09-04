/**
 * Decodes PDF hex strings (<48656c6c6f> -> "Hello"), including UTF-16BE encoding with or without BOM.
 */
export class PdfHexDecoder {
  static decode(hex: string): string {
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
}

/**
 * Decompresses FlateDecode compressed byte streams across Node.js and Browser environments.
 */
export class PdfFlateDecompressor {
  static async decompress(data: Uint8Array): Promise<Uint8Array | null> {
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

      // Direct standard zlib decompression
      let result = await tryDecompress(data, 'deflate');
      if (result) return result;

      // If data starts with zlib header (0x78), try raw deflate by stripping 2-byte header (and optional 4-byte checksum)
      if (data[0] === 0x78) {
        result = await tryDecompress(data.slice(2), 'deflate-raw');
        if (result) return result;
        if (data.length >= 6) {
          result = await tryDecompress(data.slice(2, -4), 'deflate-raw');
          if (result) return result;
        }
      }

      // Try raw deflate on unstripped data
      result = await tryDecompress(data, 'deflate-raw');
      if (result) return result;

      // Try offset zlib header if stray leading byte exists
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

    // Fallback: Node.js zlib module when DecompressionStream is missing or fails in Node.js environments
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
}

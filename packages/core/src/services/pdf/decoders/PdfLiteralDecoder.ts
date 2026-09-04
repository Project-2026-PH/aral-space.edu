/**
 * Decodes PDF literal strings and escape sequences (\n, \r, \t, \b, \f, \(, \), \\, \ddd octal).
 */
export class PdfLiteralDecoder {
  static decode(str: string): string {
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
}

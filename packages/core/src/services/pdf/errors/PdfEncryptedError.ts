/**
 * Dedicated domain error thrown when a PDF document cannot be parsed
 * because it is password-protected or uses an unsupported encryption handler.
 */
export class PdfEncryptedError extends Error {
  constructor(
    public readonly fileName: string,
    public readonly requiresPassword: boolean = false,
    message?: string
  ) {
    super(
      message ||
        (requiresPassword
          ? `PDF "${fileName}" is password-protected. Please provide an unencrypted document.`
          : `PDF "${fileName}" is encrypted with an unsupported security handler.`)
    );
    this.name = 'PdfEncryptedError';
    Object.setPrototypeOf(this, PdfEncryptedError.prototype);
  }
}

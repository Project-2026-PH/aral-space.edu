import { PdfExtractionService } from '@quiz-creator/core';

export class PdfParserController {
  static parsePlainText(text: string) {
    return PdfExtractionService.extractTextFromMockOrPlain(text);
  }
}

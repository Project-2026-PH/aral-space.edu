import { PdfExtractionService } from '@quiz-creator/core/services';

export class PdfParserController {
  static parsePlainText(text: string) {
    return PdfExtractionService.extractTextFromMockOrPlain(text);
  }
}

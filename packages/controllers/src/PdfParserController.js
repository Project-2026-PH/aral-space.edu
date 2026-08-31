import { PdfExtractionService } from '@quiz-creator/core';
export class PdfParserController {
    static parsePlainText(text) {
        return PdfExtractionService.extractTextFromMockOrPlain(text);
    }
}

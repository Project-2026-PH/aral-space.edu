import { HandoutPage } from '@quiz-creator/types';

export interface PdfParseResult {
  pages: HandoutPage[];
  pageCount: number;
}

export interface IPdfParserStrategy {
  readonly name: string;
  parse(data: Uint8Array, fileName: string): Promise<PdfParseResult>;
}

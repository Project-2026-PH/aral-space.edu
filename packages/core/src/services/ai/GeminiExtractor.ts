import { GoogleGenAI, Type } from '@google/genai';
import { RawAiQuestion, HandoutPage } from '@quiz-creator/types';

export interface GeminiExtractionOptions {
  apiKey: string;
  handoutPages: HandoutPage[];
  subjectName?: string;
  targetCount?: number;
  modelName?: string;
  onChunk?: (text: string) => void;
}

export class GeminiExtractor {
  static buildExtractionPrompt(pages: HandoutPage[], subjectName?: string, targetCount: number = 15): string {
    const formattedContent = pages
      .map((p) => `--- PAGE ${p.pageNumber} ---\n${p.text}\n`)
      .join('\n');

    return `You are an expert curriculum designer and exam question author${subjectName ? ` specializing in ${subjectName}` : ''}.
Thoroughly analyze the source handout provided below and extract high-yield conceptual multiple-choice questions.

Source Material:
${formattedContent}

Requirements:
1. Target: Exactly ${targetCount} rigorous, concept-testing multiple choice questions.
2. Each question MUST have exactly 4 plausible, distinct options.
3. correct_answer MUST be the 0-indexed integer (0, 1, 2, or 3) of the correct choice.
4. explanation MUST cite why the answer is correct according to the text.
5. source_pages MUST be an array of page numbers where the concept appears.
`;
  }

  static getQuestionSchema() {
    return {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          correct_answer: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          source_pages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER }
          }
        },
        required: ["question", "options", "correct_answer", "explanation"]
      }
    };
  }

  async extract(options: GeminiExtractionOptions): Promise<{ questions: RawAiQuestion[]; tokensUsed: number; model: string }> {
    const model = options.modelName || 'gemini-2.5-flash';
    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    const prompt = GeminiExtractor.buildExtractionPrompt(options.handoutPages, options.subjectName, options.targetCount);

    const responseStream = await ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: GeminiExtractor.getQuestionSchema(),
        temperature: 0.2
      }
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        options.onChunk?.(chunkText);
      }
    }

    const parsed = JSON.parse(fullText.trim());
    return {
      questions: parsed as RawAiQuestion[],
      tokensUsed: Math.ceil(fullText.length / 4),
      model
    };
  }
}

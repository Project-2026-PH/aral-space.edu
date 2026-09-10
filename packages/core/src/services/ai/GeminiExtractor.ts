import { GoogleGenAI, Type } from '@google/genai';
import { RawAiQuestion, HandoutPage, UserAuthoringProfile } from '@quiz-creator/types';
import { AiModelConfig } from './AiModelConfig';

export interface GeminiExtractionOptions {
  apiKey: string;
  handoutPages: HandoutPage[];
  subjectName?: string;
  targetCount?: number;
  modelName?: string;
  authoringProfile?: UserAuthoringProfile;
  onChunk?: (text: string) => void;
}

export class GeminiExtractor {
  static buildExtractionPrompt(
    pages: HandoutPage[],
    subjectName?: string,
    targetCount: number = 15,
    authoringProfile?: UserAuthoringProfile
  ): string {
    const uniqueChapters = Array.from(
      new Set(pages.map((p) => p.chapterTitle).filter((c): c is string => Boolean(c && c.trim())))
    );

    const formattedContent = pages
      .map((p) => {
        const chapterHeader = p.chapterTitle ? ` [Chapter / File: ${p.chapterTitle}]` : '';
        return `--- PAGE ${p.pageNumber}${chapterHeader} ---\n${p.text}\n`;
      })
      .join('\n');

    let multiChapterInstruction = '';
    if (uniqueChapters.length > 1) {
      multiChapterInstruction = `\n6. Multi-Chapter Balanced Distribution: The source material covers ${uniqueChapters.length} distinct chapters/files (${uniqueChapters.join(', ')}). You MUST distribute questions proportionally and evenly across ALL chapters so every chapter is thoroughly tested. In the "chapter" field, record the specific chapter name for each question.`;
    } else if (uniqueChapters.length === 1) {
      multiChapterInstruction = `\n6. Source Chapter: The handout is from chapter "${uniqueChapters[0]}". Tag questions with this chapter in the "chapter" field.`;
    }

    let styleInstruction = '';
    if (authoringProfile?.styleSummary) {
      styleInstruction += `\n7. User Style Adaptation: ${authoringProfile.styleSummary}`;
    }

    const metadataInstruction = subjectName
      ? `\nThe label "${subjectName}" is metadata only. It is not source evidence and MUST NOT introduce facts, topics, or terminology absent from the source pages.`
      : '';

    return `You are an expert curriculum designer and exam question author. The supplied source pages are the only authority; do not use outside knowledge to add topics or facts.${metadataInstruction}
Thoroughly analyze the source handout provided below and extract high-yield conceptual multiple-choice questions.

Source Material:
${formattedContent}

Requirements:
1. Target: Exactly ${targetCount} rigorous, concept-testing multiple choice questions. If the source does not support a question, do not invent one.
2. Each question MUST have exactly 4 plausible, distinct options.
3. Psychometric Rigor: Distractors MUST represent common misconceptions or realistic alternatives grounded in the source. NEVER use "All of the above", "None of the above", or "Both A and B".
4. correct_answer MUST be the 0-indexed integer (0, 1, 2, or 3) precisely pointing to the correct choice.
5. explanation MUST cite why the answer is correct according to the source text.
6. correct_explanation: Verbatim rule or principle explaining why the answer is correct.
7. distractor_explanations: An object mapping each distractor option index (e.g. {"1": "...", "2": "..."}) explaining why that choice is incorrect.
8. discriminatory_keywords: Array of specific technical keywords from the source separating the correct choice from the nearest distractor.
9. evidence_quote MUST be an exact contiguous excerpt copied from the source material, 8 to 500 characters, that directly supports the question and correct answer. Do not paraphrase it.
10. source_pages MUST contain only the page number(s) where evidence_quote appears. The page number must match the PAGE header, never a guessed or printed page number.
11. Full-Document Coverage: Questions MUST span across the entire document (beginning, middle, and end) without clustering only at the start.${multiChapterInstruction}${styleInstruction}

Return only the JSON array matching the response schema. Any question that cannot be supported by an exact evidence_quote must be omitted rather than hallucinated.
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
          correct_explanation: { type: Type.STRING },
          distractor_explanations: {
            type: Type.OBJECT,
            description: 'Map of option index string to why it is incorrect'
          },
          discriminatory_keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          evidence_quote: { type: Type.STRING },
          source_pages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER }
          },
          chapter: { type: Type.STRING }
        },
        required: ['question', 'options', 'correct_answer', 'explanation', 'evidence_quote', 'source_pages']
      }
    };
  }

  async extract(options: GeminiExtractionOptions): Promise<{ questions: RawAiQuestion[]; tokensUsed: number; model: string }> {
    const primaryModel = AiModelConfig.getGeminiModel(options.modelName);
    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    const targetCount = options.targetCount || options.authoringProfile?.targetCount || 15;
    const prompt = GeminiExtractor.buildExtractionPrompt(options.handoutPages, options.subjectName, targetCount, options.authoringProfile);

    const { result, activeModel } = await AiModelConfig.executeGeminiWithFallback(primaryModel, async (modelToUse) => {
      const responseStream = await ai.models.generateContentStream({
        model: modelToUse,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: GeminiExtractor.getQuestionSchema(),
          temperature: 0.0
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
        tokensUsed: Math.ceil(fullText.length / 4)
      };
    });

    return {
      questions: result.questions,
      tokensUsed: result.tokensUsed,
      model: activeModel
    };
  }
}

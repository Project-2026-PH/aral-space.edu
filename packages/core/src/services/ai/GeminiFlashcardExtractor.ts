import { GoogleGenAI, Type } from '@google/genai';
import { HandoutPage } from '@quiz-creator/types';
import { AiModelConfig } from './AiModelConfig';
import { VerbatimQuizBuilder } from './VerbatimQuizBuilder';

export interface GeminiFlashcardPair {
  term: string;
  definition: string;
  source_pages: number[];
}

export interface GeminiFlashcardExtractionOptions {
  apiKey: string;
  handoutPages: HandoutPage[];
  subjectName?: string;
  targetCount?: number;
  modelName?: string;
  onChunk?: (text: string) => void;
}

/**
 * Extracts clipboard-style identification pairs from PDF text without asking
 * Gemini to author, summarize, or rephrase the source material.
 */
export class GeminiFlashcardExtractor {
  static buildExtractionPrompt(
    pages: HandoutPage[],
    subjectName?: string,
    targetCount: number = 100
  ): string {
    const formattedContent = pages
      .map((page) => {
        const chapterHeader = page.chapterTitle ? ` [Chapter / File: ${page.chapterTitle}]` : '';
        return `--- PAGE ${page.pageNumber}${chapterHeader} ---\n${page.text}\n`;
      })
      .join('\n');

    return `TASK:
Read the source material and extract up to ${targetCount} explicit term-and-definition pairs${subjectName ? ` for ${subjectName}` : ''}.

This is a verbatim transformation task, not a writing task.

Recognize the same structural cues as the clipboard parser: numbered term/definition blocks, heading followed by explanatory text, bulleted term lists, colon/dash/TSV pairs, definition-verb and passive naming sentences, and inline appositive definitions. Use those cues only to identify boundaries; never rewrite the source text.

RULES:
1. term is the exact label, heading, or vocabulary word as it appears in the source.
2. definition is copied from the source text exactly as written. Preserve wording, spelling, punctuation, capitalization, and meaning.
3. Never summarize, explain, normalize, correct, complete, or paraphrase a definition.
4. Skip a candidate when the source does not contain an explicit explanatory definition.
5. source_pages contains the page number(s) where the copied definition appears.
6. Do not include commentary, markdown, or fields other than term, definition, and source_pages.

Return ONLY a JSON array matching this shape:
[{"term":"...","definition":"...","source_pages":[1]}]

Source Material:
${formattedContent}`;
  }

  static getPairSchema() {
    return {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: { type: Type.STRING },
          source_pages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER }
          }
        },
        required: ['term', 'definition', 'source_pages']
      }
    };
  }

  private static normalizePairs(
    value: unknown,
    pages: HandoutPage[]
  ): GeminiFlashcardPair[] {
    const rawPairs = Array.isArray(value)
      ? value
      : value && typeof value === 'object' && Array.isArray((value as { pairs?: unknown }).pairs)
        ? (value as { pairs: unknown[] }).pairs
        : [];

    const seenDefinitions = new Set<string>();
    const pairs: GeminiFlashcardPair[] = [];

    for (const raw of rawPairs) {
      if (!raw || typeof raw !== 'object') continue;
      const candidate = raw as {
        term?: unknown;
        definition?: unknown;
        source_pages?: unknown;
      };
      if (
        typeof candidate.term !== 'string' ||
        typeof candidate.definition !== 'string' ||
        !Array.isArray(candidate.source_pages)
      ) {
        continue;
      }

      const term = candidate.term.trim();
      const definition = candidate.definition.trim();
      if (!term || !definition) continue;

      // Reject hallucinated or paraphrased definitions. Whitespace and PDF
      // encoding differences are normalized by the shared verifier, while the
      // returned definition itself remains unchanged apart from outer padding.
      const matchingPages = pages
        .filter((page) => VerbatimQuizBuilder.verifyVerbatimSubstring(page.text, definition))
        .map((page) => page.pageNumber);
      const declaredPages = candidate.source_pages.filter(
        (page): page is number => Number.isInteger(page) && page >= 1
      );
      const sourcePages = matchingPages.length > 0
        ? matchingPages
        : declaredPages.filter((page) => pages.some((sourcePage) => sourcePage.pageNumber === page));

      if (sourcePages.length === 0) continue;

      const normalizedDefinition = VerbatimQuizBuilder.normalizeForVerification(definition);
      if (seenDefinitions.has(normalizedDefinition)) continue;
      seenDefinitions.add(normalizedDefinition);
      pairs.push({ term, definition, source_pages: sourcePages });
    }

    return pairs;
  }

  async extract(
    options: GeminiFlashcardExtractionOptions
  ): Promise<{ pairs: GeminiFlashcardPair[]; tokensUsed: number; model: string }> {
    const primaryModel = AiModelConfig.getGeminiModel(options.modelName);
    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    const targetCount = options.targetCount || 100;
    const prompt = GeminiFlashcardExtractor.buildExtractionPrompt(
      options.handoutPages,
      options.subjectName,
      targetCount
    );

    console.log(
      `[GeminiFlashcardExtractor] Extracting verbatim pairs with "${primaryModel}" (thinkingBudget=0, temperature=0)`
    );

    const { result, activeModel } = await AiModelConfig.executeGeminiWithFallback(
      primaryModel,
      async (modelToUse) => {
        const responseStream = await ai.models.generateContentStream({
          model: modelToUse,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: GeminiFlashcardExtractor.getPairSchema(),
            temperature: 0.0,
            thinkingConfig: { thinkingBudget: 0 }
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

        const parsed = JSON.parse(fullText.trim()) as unknown;
        return {
          pairs: GeminiFlashcardExtractor.normalizePairs(parsed, options.handoutPages),
          tokensUsed: Math.ceil(fullText.length / 4)
        };
      }
    );

    return {
      pairs: result.pairs,
      tokensUsed: result.tokensUsed,
      model: activeModel
    };
  }
}

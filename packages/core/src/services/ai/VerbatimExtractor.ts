import { GoogleGenAI, Type } from '@google/genai';
import Groq from 'groq-sdk';
import { HandoutPage, VerbatimTermPair } from '@quiz-creator/types';
import { GroqReviewer } from './GroqReviewer';

export interface VerbatimExtractionOptions {
  apiKey?: string;       // Gemini API key
  groqApiKey?: string;   // Groq API key
  handoutPages: HandoutPage[];
  subjectName?: string;
  targetCount?: number;
  modelName?: string;
  onChunk?: (text: string) => void;
}

export class VerbatimExtractor {
  private static readonly DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
  private static readonly DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

  static buildExtractionPrompt(pages: HandoutPage[], subjectName?: string, targetCount: number = 15): string {
    const formattedContent = pages
      .map((p) => {
        const chapterHeader = p.chapterTitle ? ` [Chapter / File: ${p.chapterTitle}]` : '';
        return `--- PAGE ${p.pageNumber}${chapterHeader} ---\n${p.text}\n`;
      })
      .join('\n');

    return `TASK:
Extract up to ${targetCount} exact term-and-definition pairs directly from the source text${subjectName ? ` for ${subjectName}` : ''}.

CONSTRAINTS:
1. Do NOT summarize, rephrase, normalize, or paraphrase the text in any way.
2. The verbatim_definition MUST be an exact character-for-character substring copied directly from the document.
3. If an explicit definition is not directly stated in the document, skip the term.
4. Record the accurate source_page integer for where the verbatim quote appears.
5. Record the chapter name in the "chapter" field if specified in page headers.

Source Material:
${formattedContent}

Output a JSON array of objects with keys: "term", "verbatim_definition", "source_page", and "chapter".`;
  }

  static getPairSchema() {
    return {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          verbatim_definition: { type: Type.STRING },
          source_page: { type: Type.INTEGER },
          chapter: { type: Type.STRING }
        },
        required: ['term', 'verbatim_definition', 'source_page']
      }
    };
  }

  async extract(
    options: VerbatimExtractionOptions
  ): Promise<{ pairs: VerbatimTermPair[]; tokensUsed: number; model: string }> {
    const targetCount = options.targetCount || 15;

    // 1. Primary: Gemini extraction at temperature 0.0
    if (options.apiKey) {
      try {
        const model = options.modelName || VerbatimExtractor.DEFAULT_GEMINI_MODEL;
        const ai = new GoogleGenAI({ apiKey: options.apiKey });
        const prompt = VerbatimExtractor.buildExtractionPrompt(options.handoutPages, options.subjectName, targetCount);

        const responseStream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: VerbatimExtractor.getPairSchema(),
            temperature: 0.0 // Zero variance for verbatim exact extraction
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
        const pairs: VerbatimTermPair[] = Array.isArray(parsed) ? parsed : (parsed.pairs || parsed.terms || []);

        return {
          pairs,
          tokensUsed: Math.ceil(fullText.length / 4),
          model: `gemini/${model}`
        };
      } catch (geminiErr: any) {
        if (!options.groqApiKey) throw geminiErr;
        // Fallback to Groq if Gemini key fails
      }
    }

    // 2. Groq Extraction at temperature 0.0
    if (options.groqApiKey) {
      const model = options.modelName || VerbatimExtractor.DEFAULT_GROQ_MODEL;
      const groq = new Groq({ apiKey: options.groqApiKey });
      const prompt = VerbatimExtractor.buildExtractionPrompt(options.handoutPages, options.subjectName, targetCount);

      const completion = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a strict data extraction system. You output valid JSON containing an array of exact verbatim quotes.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.0,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content || '{}';
      options.onChunk?.(content);

      let pairs: VerbatimTermPair[] = [];
      try {
        const parsedObj = JSON.parse(content);
        if (Array.isArray(parsedObj)) {
          pairs = parsedObj;
        } else if (parsedObj.pairs && Array.isArray(parsedObj.pairs)) {
          pairs = parsedObj.pairs;
        } else if (parsedObj.terms && Array.isArray(parsedObj.terms)) {
          pairs = parsedObj.terms;
        } else {
          const firstArray = Object.values(parsedObj).find((v) => Array.isArray(v));
          pairs = (firstArray as VerbatimTermPair[]) || [];
        }
      } catch {
        const sanitized = GroqReviewer.sanitizeJsonString(content);
        pairs = JSON.parse(sanitized);
      }

      return {
        pairs,
        tokensUsed: completion.usage?.total_tokens || Math.ceil(content.length / 4),
        model: `groq/${model}`
      };
    }

    throw new Error('No API keys configured for VerbatimExtractor.');
  }
}

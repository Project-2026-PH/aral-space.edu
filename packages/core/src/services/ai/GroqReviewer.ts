import Groq from 'groq-sdk';
import { RawAiQuestion, HandoutPage, UserAuthoringProfile } from '@quiz-creator/types';

export interface GroqReviewOptions {
  apiKey: string;
  candidateQuestions: RawAiQuestion[];
  subjectName?: string;
  modelName?: string;
  authoringProfile?: UserAuthoringProfile;
  onChunk?: (text: string) => void;
}

export interface GroqDirectOptions {
  apiKey: string;
  handoutPages: HandoutPage[];
  subjectName?: string;
  targetCount?: number;
  modelName?: string;
  authoringProfile?: UserAuthoringProfile;
  onChunk?: (text: string) => void;
}

export class GroqReviewer {
  private static readonly DEFAULT_MODEL = 'llama-3.3-70b-versatile';

  static sanitizeJsonString(str: string): string {
    let cleaned = str.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
    return cleaned;
  }

  async reviewAndPolish(options: GroqReviewOptions): Promise<{ questions: RawAiQuestion[]; tokensUsed: number; model: string }> {
    const model = options.modelName || GroqReviewer.DEFAULT_MODEL;
    const groq = new Groq({ apiKey: options.apiKey });

    const systemPrompt = `You are a Senior Psychometrician and Lead Pedagogy Auditor.
Your task is to audit, refine, and polish a draft set of candidate exam questions.

AUDIT RULES:
1. Distractor Quality: Eliminate obvious/silly distractors. Replace them with realistic, high-level misconceptions.
2. Cliché Removal: Remove all "All of the above", "Both A and B", "None of the above" options.
3. Unambiguity: Guarantee exactly ONE option is unequivocally correct according to the explanation.
4. Index Integrity: Ensure correct_answer is strictly 0, 1, 2, or 3, precisely matching the intended option index.
5. Explanation: Keep explanations razor-sharp and instructional.
6. Preserve Citations: Retain source_pages arrays.
7. Preserve Chapter Metadata: Retain chapter tags and distribute focus evenly across chapters.${options.authoringProfile?.styleSummary ? `\n8. User Style Alignment: ${options.authoringProfile.styleSummary}` : ''}

Output ONLY valid JSON containing an array of question objects matching the input format.`;

    const userPrompt = `Audit and polish these candidate questions${options.subjectName ? ` for subject ${options.subjectName}` : ''}:
${JSON.stringify(options.candidateQuestions, null, 2)}

Return the polished JSON array:`;

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content || '[]';
    options.onChunk?.(content);

    let parsed: any;
    try {
      const parsedObj = JSON.parse(content);
      // Groq json_object might return { "questions": [...] } or direct array
      if (Array.isArray(parsedObj)) {
        parsed = parsedObj;
      } else if (parsedObj.questions && Array.isArray(parsedObj.questions)) {
        parsed = parsedObj.questions;
      } else {
        const firstArrayVal = Object.values(parsedObj).find(v => Array.isArray(v));
        parsed = firstArrayVal || options.candidateQuestions;
      }
    } catch {
      const sanitized = GroqReviewer.sanitizeJsonString(content);
      parsed = JSON.parse(sanitized);
    }

    return {
      questions: parsed as RawAiQuestion[],
      tokensUsed: completion.usage?.total_tokens || Math.ceil(content.length / 4),
      model
    };
  }

  async generateDirect(options: GroqDirectOptions): Promise<{ questions: RawAiQuestion[]; tokensUsed: number; model: string }> {
    const model = options.modelName || GroqReviewer.DEFAULT_MODEL;
    const groq = new Groq({ apiKey: options.apiKey });
    const targetCount = options.targetCount || options.authoringProfile?.targetCount || 15;
    const uniqueChapters = Array.from(
      new Set(options.handoutPages.map((p) => p.chapterTitle).filter((c): c is string => Boolean(c && c.trim())))
    );

    const formattedContent = options.handoutPages
      .map((p) => {
        const chapterHeader = p.chapterTitle ? ` [Chapter / File: ${p.chapterTitle}]` : '';
        return `--- PAGE ${p.pageNumber}${chapterHeader} ---\n${p.text}\n`;
      })
      .join('\n');

    let multiChapterInstruction = '';
    if (uniqueChapters.length > 1) {
      multiChapterInstruction = `\n6. Multi-Chapter Balance: Material spans ${uniqueChapters.length} chapters (${uniqueChapters.join(', ')}). Distribute questions proportionally across ALL chapters. Include "chapter" field with the corresponding chapter name.`;
    }

    let styleInstruction = '';
    if (options.authoringProfile?.styleSummary) {
      styleInstruction += `\n7. User Style Adaptation: ${options.authoringProfile.styleSummary}`;
    }
    if (options.authoringProfile?.sampleQuestions && options.authoringProfile.sampleQuestions.length > 0) {
      styleInstruction += `\n8. Match the formatting and phrasing of user's previous questions:\n${options.authoringProfile.sampleQuestions
        .map((s, idx) => `   [Example ${idx + 1}] "${s.question}" | Options: [${s.options.join(', ')}]`)
        .join('\n')}`;
    }

    const prompt = `You are an expert exam author${options.subjectName ? ` for ${options.subjectName}` : ''}.
Generate a comprehensive multiple-choice quiz based on the text below.

Source Material:
${formattedContent}

Requirements:
1. Target: Exactly ${targetCount} multiple-choice questions.
2. 4 plausible options per question.
3. correct_answer is the 0-indexed integer (0, 1, 2, or 3).
4. explanation cites why it is correct.
5. source_pages is an array of page numbers.${multiChapterInstruction}${styleInstruction}

Return a JSON object with key "questions" containing the array of questions.`;

    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content || '{}';
    options.onChunk?.(content);

    const parsedObj = JSON.parse(content);
    const questions = Array.isArray(parsedObj) ? parsedObj : (parsedObj.questions || []);

    return {
      questions,
      tokensUsed: completion.usage?.total_tokens || Math.ceil(content.length / 4),
      model
    };
  }
}

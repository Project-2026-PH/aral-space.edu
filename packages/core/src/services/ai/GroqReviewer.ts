import Groq from 'groq-sdk';
import { RawAiQuestion, HandoutPage } from '@quiz-creator/types';

export interface GroqReviewOptions {
  apiKey: string;
  candidateQuestions: RawAiQuestion[];
  subjectName?: string;
  modelName?: string;
  onChunk?: (text: string) => void;
}

export interface GroqDirectOptions {
  apiKey: string;
  handoutPages: HandoutPage[];
  subjectName?: string;
  targetCount?: number;
  modelName?: string;
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
    const targetCount = options.targetCount || 15;

    const formattedContent = options.handoutPages
      .map((p) => `--- PAGE ${p.pageNumber} ---\n${p.text}\n`)
      .join('\n');

    const prompt = `You are an expert exam author${options.subjectName ? ` for ${options.subjectName}` : ''}.
Generate a comprehensive multiple-choice quiz based on the text below.

Source Material:
${formattedContent}

Requirements:
1. Target: Exactly ${targetCount} multiple-choice questions.
2. 4 plausible options per question.
3. correct_answer is the 0-indexed integer (0, 1, 2, or 3).
4. explanation cites why it is correct.
5. source_pages is an array of page numbers.

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

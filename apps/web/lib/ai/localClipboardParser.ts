import { getPipeline } from './localExplanationEngine';
import type { ParsedClipboard } from '../clipboardParser';

export interface SmolLMParsedCard {
  term: string;
  question: string;
}

/**
 * Local AI fallback using in-browser SmolLM2-360M-Instruct.
 * Analyzes unstructured or inverted sentences (e.g. "Pixel data is stored in a region of memory called the framebuffer.")
 * to accurately extract the target term and paraphrase the definition into a standard study question prompt.
 */
export async function parseWithSmolLM2(rawText: string): Promise<ParsedClipboard | null> {
  const text = rawText.trim();
  if (!text || text.length < 15 || text.length > 800) return null;

  try {
    const generator = await getPipeline();
    if (!generator) return null;

    const messages = [
      {
        role: 'system',
        content: `You are an educational quiz and flashcard creator.
Analyze the user's sentence and extract:
1. "term": The single key concept or vocabulary word being defined (1 to 4 words).
2. "question": A direct flashcard question prompt. Paraphrase the sentence so the answer is the term without losing factual details. If the sentence was passive (e.g., "X is stored in Y called Z"), rephrase as "This is stored in Y..." or "The region of memory where X is stored...".
Return ONLY strict JSON: {"term": "...", "question": "..."}`.trim(),
      },
      {
        role: 'user',
        content: `Sentence: "${text}"`,
      },
    ];

    const output = await generator(messages, {
      max_new_tokens: 80,
      temperature: 0.1,
      do_sample: false,
    });

    let generatedText = '';
    if (Array.isArray(output) && output[0]?.generated_text) {
      const gen = output[0].generated_text;
      if (Array.isArray(gen)) {
        const lastMsg = gen[gen.length - 1];
        generatedText = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
      } else if (typeof gen === 'string') {
        generatedText = gen;
      }
    }

    if (!generatedText) return null;

    const jsonMatch = generatedText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<SmolLMParsedCard>;
    if (
      typeof parsed.term === 'string' &&
      typeof parsed.question === 'string' &&
      parsed.term.trim() &&
      parsed.question.trim()
    ) {
      const cleanTerm = parsed.term.replace(/^(?:the|a|an)\s+/i, '').replace(/[.!?:]+$/, '').trim();
      let cleanQuestion = parsed.question.trim();
      cleanQuestion = cleanQuestion.charAt(0).toUpperCase() + cleanQuestion.slice(1);

      return {
        type: 'single_pair',
        term: cleanTerm,
        definition: cleanQuestion,
      };
    }
  } catch (err) {
    console.warn('[SmolLM2] Fallback card extraction failed:', err);
  }

  return null;
}

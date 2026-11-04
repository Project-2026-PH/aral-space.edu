import { getPipeline } from './localExplanationEngine';
import type { ParsedClipboard } from '../clipboardParser';

export interface SmolLMParsedCard {
  term: string;
  definition: string;
}

interface SmolLMParsedTermDefinition {
  term: string;
  definition: string;
}

function extractJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index++) {
    const character = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }

  return null;
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
Analyze the pasted study text and create useful flashcards without adding facts.

The term is always the card's answer. The definition is the question prompt that leads to that term; do not put the explanatory description in the answer field.

For one clear fact, return:
{"term":"the answer term","definition":"A concise question prompt that asks for the term"}

For two or more distinct, independently testable facts, return:
{"cards":[{"term":"the answer term","definition":"A concise question prompt that asks for the term"},{"term":"another answer term","definition":"Another question prompt"}]}

Split different concepts into separate cards. Combine tightly related facts about the same concept when one prompt can ask for that concept. Keep prompts grounded in the pasted text. Do not make duplicate cards. Return at most 12 cards. Return ONLY strict JSON.

Example input: "The successors of a node are its child nodes, while the predecessor of a node is called its parent. Each child node has exactly one parent except for a special node called the root node. This node is the tree's topmost node."
Example output: {"cards":[{"term":"successors","definition":"What are the child nodes of a node called?"},{"term":"parent","definition":"What is the predecessor of a node called?"},{"term":"root node","definition":"Which node is the topmost node in the tree and has no parent?"}]}

Example input: "The accumulated transformations of an object are stored as a product of matrices called the model matrix. The object's current location, orientation, and scale are collectively called its transform. Its transform relative to the scene graph root is called a world transformation."
Example output: {"cards":[{"term":"model matrix","definition":"Which matrix stores an object's accumulated transformation product?"},{"term":"transform","definition":"What are an object's location, orientation, and scale collectively called?"},{"term":"world transformation","definition":"What is an object's transform relative to the scene graph root called?"}]}`.trim(),
      },
      {
        role: 'user',
        content: `Sentence: "${text}"`,
      },
    ];

    const output = await generator(messages, {
      max_new_tokens: 220,
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

    const jsonObject = extractJsonObject(generatedText);
    if (!jsonObject) return null;

    const parsed = JSON.parse(jsonObject) as {
      term?: unknown;
      definition?: unknown;
      question?: unknown;
      cards?: unknown;
    };

    if (Array.isArray(parsed.cards)) {
      const seen = new Set<string>();
      const items: SmolLMParsedTermDefinition[] = [];

      for (const value of parsed.cards) {
        if (!value || typeof value !== 'object') continue;
        const item = value as Record<string, unknown>;
        if (typeof item.term !== 'string') continue;

        const rawDefinition = typeof item.definition === 'string'
          ? item.definition
          : typeof item.question === 'string'
            ? item.question
            : '';
        let term = item.term.replace(/^(?:the|a|an)\s+/i, '').replace(/[.!?:]+$/, '').trim();
        let definition = rawDefinition.trim();
        if (!term || !definition) continue;
        term = term.charAt(0).toUpperCase() + term.slice(1);
        definition = definition.charAt(0).toUpperCase() + definition.slice(1);
        if (!/[?]$/.test(definition)) {
          definition = `${definition.replace(/[.!]+$/, '').trim()}?`;
        }

        const key = term.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ term, definition });
        if (items.length === 12) break;
      }

      if (items.length > 1) {
        return { type: 'bulk_terms', items };
      }
      if (items.length === 1) {
        return { type: 'single_pair', ...items[0] };
      }
    }

    if (
      typeof parsed.term === 'string' &&
      (typeof parsed.definition === 'string' || typeof parsed.question === 'string') &&
      parsed.term.trim() &&
      (typeof parsed.definition !== 'string' || parsed.definition.trim()) &&
      (typeof parsed.question !== 'string' || parsed.question.trim())
    ) {
      const cleanTerm = parsed.term.replace(/^(?:the|a|an)\s+/i, '').replace(/[.!?:]+$/, '').trim();
      const rawDefinition = typeof parsed.definition === 'string' ? parsed.definition : parsed.question as string;
      let cleanDefinition = rawDefinition.trim();
      cleanDefinition = cleanDefinition.charAt(0).toUpperCase() + cleanDefinition.slice(1);
      if (!/[?]$/.test(cleanDefinition) && /\b(?:what|which|who|where|when|why|how)\b/i.test(cleanDefinition)) {
        cleanDefinition = `${cleanDefinition}?`;
      }

      return {
        type: 'single_pair',
        term: cleanTerm,
        definition: cleanDefinition,
      };
    }
  } catch (err) {
    console.warn('[SmolLM2] Fallback card extraction failed:', err);
  }

  return null;
}

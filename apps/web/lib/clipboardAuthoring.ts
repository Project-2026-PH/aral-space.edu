import { buildClipboardQuestionPrompt } from './clipboardQuestionPrompt';
import type { ParsedClipboard } from './clipboardParser';

export interface ClipboardAuthoringCard {
  question: string;
  answer: string;
}

/**
 * Converts only one recognized clipboard pair into an authoring card.
 * Structured lists remain available to the caller for preview/import handling.
 */
type ClipboardAuthoringInput = ParsedClipboard | {
  readonly type: 'bulk_terms';
  readonly items: readonly { readonly term: string; readonly definition: string }[];
} | {
  readonly type: 'question_answers';
  readonly items: readonly { readonly question: string; readonly answer: string }[];
} | {
  readonly type: 'enumeration_blocks';
  readonly blocks: readonly { readonly header: string; readonly items: readonly string[] }[];
};

export function createClipboardAuthoringCard(
  parsed: ClipboardAuthoringInput | null
): ClipboardAuthoringCard | null {
  if (!parsed) return null;

  if (parsed.type === 'question_answer') {
    return {
      question: parsed.question,
      answer: parsed.answer
    };
  }

  if (parsed.type === 'single_pair') {
    return {
      question: buildClipboardQuestionPrompt(parsed.definition, parsed.term),
      answer: parsed.term
    };
  }

  return null;
}

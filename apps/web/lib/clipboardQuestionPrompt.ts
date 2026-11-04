import { QuizTransformService } from '@quiz-creator/core';
import { convertToQuestion } from './convertToQuestion';

const FALLBACK_SUFFIX = 'What is this called?';

/**
 * Builds an identification prompt from a parsed clipboard definition.
 * Definitions that still contain their term use the deterministic converter;
 * parser-stripped definitions use the existing contextual fallback instead.
 */
export function buildClipboardQuestionPrompt(text: string, term: string): string {
  const trimmedText = text.trim();
  const trimmedTerm = term.trim();
  if (trimmedText && trimmedTerm && /\?\s*$/.test(trimmedText)) {
    return trimmedText;
  }

  const converted = convertToQuestion(trimmedText, trimmedTerm);
  if (!trimmedText || !trimmedTerm || /\?\s*$/.test(converted)) {
    return converted;
  }

  const fallback = QuizTransformService.phraseIdentificationPrompt(trimmedText, trimmedTerm).trim();
  if (!fallback || /\?\s*$/.test(fallback)) {
    return fallback;
  }

  return `${fallback} ${FALLBACK_SUFFIX}`;
}

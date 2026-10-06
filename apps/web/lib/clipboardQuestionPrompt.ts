import { QuizTransformService } from '@quiz-creator/core';
import { convertToQuestion } from './convertToQuestion';

const FALLBACK_SUFFIX = 'What is this called?';

/**
 * Builds an identification prompt from a parsed clipboard definition.
 * Definitions that still contain their term use the deterministic converter;
 * parser-stripped definitions use the existing contextual fallback instead.
 */
export function buildClipboardQuestionPrompt(text: string, term: string): string {
  const converted = convertToQuestion(text, term);
  if (!text.trim() || !term.trim() || /\?\s*$/.test(converted)) {
    return converted;
  }

  const fallback = QuizTransformService.phraseIdentificationPrompt(text, term).trim();
  if (!fallback || /\?\s*$/.test(fallback)) {
    return fallback;
  }

  return `${fallback} ${FALLBACK_SUFFIX}`;
}

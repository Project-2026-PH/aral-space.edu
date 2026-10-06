import { areAnswersEquivalent } from '@quiz-creator/core';
import type { QuizQuestion } from '@quiz-creator/types';

export type TypedAnswerMode = 'learn' | 'identification';

function isEnumerationQuestion(question: QuizQuestion): boolean {
  return question.question_type === 'enumeration';
}

export function getQuestionAnswer(question: QuizQuestion): string {
  if (isEnumerationQuestion(question)) {
    const itemCount = question.options.filter((option) => option.trim()).length;
    const explicitAnswer = question.answer_text?.trim() || '';
    const explicitCount = Number.parseInt(explicitAnswer, 10);
    if (/^\d+$/.test(explicitAnswer) && (explicitCount === itemCount || itemCount === 0)) return explicitAnswer;
    return String(itemCount);
  }

  return question.answer_text?.trim() || question.options[question.correct_answer]?.trim() || '';
}

/**
 * Learn mode historically collapses whitespace while direct identification only
 * trims and lowercases. Keep both policies explicit so the refactor does not
 * silently change either user-facing answer path.
 */
export function normalizeTypedAnswer(value: string, mode: TypedAnswerMode = 'learn'): string {
  const trimmed = value.trim().toLocaleLowerCase();
  return mode === 'learn' ? trimmed.replace(/\s+/g, ' ') : trimmed;
}

export function evaluateTypedAnswer(
  value: string,
  expected: string,
  _mode: TypedAnswerMode = 'learn'
): boolean {
  return areAnswersEquivalent(value, expected);
}

function maskAnswer(answer: string): string {
  const characters = Array.from(answer.trim());
  const answerCharacters = characters.filter((character) => /[A-Za-z0-9]/.test(character)).length;
  const revealedCharacters = answerCharacters >= 5 ? 3 : answerCharacters > 1 ? 1 : 0;
  let revealed = 0;

  return characters.map((character) => {
    if (!/[A-Za-z0-9]/.test(character)) return character;
    if (revealed < revealedCharacters) {
      revealed += 1;
      return character;
    }
    return '_';
  }).join('') || '____';
}

export function getQuestionHint(question: QuizQuestion): string {
  return maskAnswer(getQuestionAnswer(question));
}

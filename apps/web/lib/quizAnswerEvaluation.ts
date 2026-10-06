import { areAnswersEquivalent, normalizeAnswerForComparison } from '@quiz-creator/core';
import type { QuizQuestion } from '@quiz-creator/types';

export type TypedAnswerMode = 'learn' | 'identification';

function isEnumerationQuestion(question: QuizQuestion): boolean {
  return question.question_type === 'enumeration';
}

export function getQuestionAnswer(question: QuizQuestion): string {
  if (isEnumerationQuestion(question)) {
    const itemCount = Array.isArray(question.options)
      ? question.options.filter((option) => typeof option === 'string' && option.trim()).length
      : 0;
    const explicitAnswer = typeof question.answer_text === 'string' ? question.answer_text.trim() : '';
    const explicitCount = Number.parseInt(explicitAnswer, 10);
    if (/^\d+$/.test(explicitAnswer) && (explicitCount === itemCount || itemCount === 0)) {
      return explicitAnswer;
    }
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
  if (isEnumerationQuestion(question)) {
    const metadata = getEnumerationMetadata(question);
    if (metadata.status === 'available') {
      return metadata.terms.map(maskAnswer).join(', ');
    }
  }
  return maskAnswer(getQuestionAnswer(question));
}

export type EnumerationMetadataStatus = 'available' | 'unavailable' | 'invalid';
export type EnumerationMetadataReason =
  | 'missing_terms'
  | 'malformed_terms'
  | 'malformed_distractors'
  | 'insufficient_terms'
  | 'excess_terms'
  | 'invalid_total';

export interface EnumerationMetadata {
  questionId?: string;
  total: number;
  terms: string[];
  distractors: string[];
  status: EnumerationMetadataStatus;
  reason?: EnumerationMetadataReason;
}

export interface EnumerationAttempt {
  key: string;
  rawValue: string;
  isCorrect: boolean;
  sequence: number;
  feedback: 'correct' | 'incorrect';
}

export interface EnumerationState {
  questionId: string;
  total: number;
  attempts: EnumerationAttempt[];
  attemptedKeys: string[];
  correctKeys: string[];
  wrongKeys: string[];
  /** Stable canonical keys allow two-argument pure transitions after restore. */
  canonicalKeys: string[];
  status: 'active' | 'complete' | 'unavailable';
  verdict: boolean | null;
  lastFeedback: 'correct' | 'incorrect' | null;
}

export function getAnswerIdentityKey(value: string): string {
  return normalizeAnswerForComparison(value.trim());
}

interface ParsedList {
  valid: boolean;
  supplied: boolean;
  values: string[];
}

function parseList(value: unknown): ParsedList {
  if (value === undefined || value === null) {
    return { valid: true, supplied: false, values: [] };
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return { valid: false, supplied: true, values: [] };
  }
  return {
    valid: true,
    supplied: true,
    values: value.map((item) => item.trim()).filter(Boolean)
  };
}

function equivalent(left: string, right: string): boolean {
  const leftKey = getAnswerIdentityKey(left);
  const rightKey = getAnswerIdentityKey(right);
  return Boolean(leftKey && rightKey && (leftKey === rightKey || areAnswersEquivalent(left, right)));
}

function uniqueEquivalent(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (!value || result.some((existing) => equivalent(existing, value))) continue;
    result.push(value);
  }
  return result;
}

export function getEnumerationMetadata(question: QuizQuestion): EnumerationMetadata {
  const optionList = parseList(question.options);
  const answerTerms = parseList(question.answer_terms);
  const distractors = parseList(question.enumeration_distractors);
  const questionId = question.id;

  if (!optionList.valid || !answerTerms.valid) {
    return {
      questionId,
      total: 0,
      terms: [],
      distractors: [],
      status: 'unavailable',
      reason: 'malformed_terms'
    };
  }

  const nonEmptyLegacyOptions = optionList.values;
  const totalFromOptions = nonEmptyLegacyOptions.length;
  const rawAnswerText = typeof question.answer_text === 'string' ? question.answer_text.trim() : '';
  const numericTotal = /^\d+$/.test(rawAnswerText) ? Number(rawAnswerText) : 0;
  const total = totalFromOptions > 0 ? totalFromOptions : numericTotal;
  const terms = uniqueEquivalent(answerTerms.supplied ? answerTerms.values : nonEmptyLegacyOptions);

  if (!Number.isSafeInteger(total) || total <= 0) {
    return { questionId, total: 0, terms, distractors: [], status: 'invalid', reason: 'invalid_total' };
  }
  if (terms.length === 0) {
    return { questionId, total, terms, distractors: [], status: 'unavailable', reason: 'missing_terms' };
  }
  if (terms.length < total) {
    return { questionId, total, terms, distractors: [], status: 'unavailable', reason: 'insufficient_terms' };
  }
  if (terms.length > total) {
    return { questionId, total, terms, distractors: [], status: 'unavailable', reason: 'excess_terms' };
  }
  if (!distractors.valid) {
    return { questionId, total, terms, distractors: [], status: 'unavailable', reason: 'malformed_distractors' };
  }

  const canonicalDistractors = uniqueEquivalent(distractors.values)
    .filter((distractor) => !terms.some((term) => equivalent(term, distractor)));
  return {
    questionId,
    total,
    terms,
    distractors: canonicalDistractors,
    status: 'available'
  };
}

export function createEnumerationState(metadata: EnumerationMetadata): EnumerationState;
export function createEnumerationState(questionId: string, metadata: EnumerationMetadata): EnumerationState;
export function createEnumerationState(
  metadataOrQuestionId: EnumerationMetadata | string,
  legacyMetadata?: EnumerationMetadata
): EnumerationState {
  const metadata = typeof metadataOrQuestionId === 'string' ? legacyMetadata! : metadataOrQuestionId;
  const questionId = typeof metadataOrQuestionId === 'string'
    ? metadataOrQuestionId
    : metadata.questionId || '';
  return {
    questionId,
    total: metadata.total,
    attempts: [],
    attemptedKeys: [],
    correctKeys: [],
    wrongKeys: [],
    canonicalKeys: metadata.terms.map(getAnswerIdentityKey),
    status: metadata.status === 'available' ? 'active' : 'unavailable',
    verdict: null,
    lastFeedback: null
  };
}

function isAlreadyAttempted(state: EnumerationState, value: string): boolean {
  return state.attempts.some((attempt) => equivalent(attempt.rawValue, value))
    || state.attemptedKeys.includes(getAnswerIdentityKey(value));
}

function matchesCanonicalTerm(state: EnumerationState, value: string, metadata?: EnumerationMetadata): boolean {
  if (metadata) return metadata.terms.some((term) => equivalent(term, value));
  return state.canonicalKeys.some((canonicalKey) => equivalent(canonicalKey, value));
}

export function submitEnumerationAttempt(
  state: EnumerationState,
  value: string,
  metadata?: EnumerationMetadata
): EnumerationState {
  if (state.status !== 'active' || state.attemptedKeys.length >= state.total) return state;
  const rawValue = value.trim();
  const key = getAnswerIdentityKey(rawValue);
  if (!key || isAlreadyAttempted(state, rawValue)) return state;

  const isCorrect = matchesCanonicalTerm(state, rawValue, metadata);
  const attempt: EnumerationAttempt = {
    key,
    rawValue,
    isCorrect,
    sequence: state.attempts.length + 1,
    feedback: isCorrect ? 'correct' : 'incorrect'
  };
  const attempts = [...state.attempts, attempt];
  const attemptedKeys = [...state.attemptedKeys, key];
  const correctKeys = isCorrect ? [...state.correctKeys, key] : state.correctKeys;
  const wrongKeys = isCorrect ? state.wrongKeys : [...state.wrongKeys, key];
  const complete = attemptedKeys.length === state.total;
  const verdict = complete
    ? wrongKeys.length === 0 && (metadata
      ? metadata.terms.every((term) => correctKeys.some((correctKey) => equivalent(correctKey, term)))
      : state.canonicalKeys.every((canonicalKey) => correctKeys.some((correctKey) => equivalent(correctKey, canonicalKey))))
    : null;

  return {
    ...state,
    attempts,
    attemptedKeys,
    correctKeys,
    wrongKeys,
    status: complete ? 'complete' : 'active',
    verdict,
    lastFeedback: attempt.feedback
  };
}

export interface EnumerationOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export function projectEnumerationOptions(metadata: EnumerationMetadata): EnumerationOption[] {
  if (metadata.status !== 'available') return [];
  return [
    ...metadata.terms.map((text, index) => ({ id: `correct-${index}`, text, isCorrect: true })),
    ...metadata.distractors.map((text, index) => ({ id: `distractor-${index}`, text, isCorrect: false }))
  ];
}

export function finalizeEnumerationState(
  state: EnumerationState,
  metadata?: EnumerationMetadata
): EnumerationState {
  if (state.status !== 'complete') return state;
  const verdict = state.wrongKeys.length === 0 && (metadata
    ? metadata.terms.every((term) => state.correctKeys.some((key) => equivalent(key, term)))
    : state.canonicalKeys.every((key) => state.correctKeys.some((correctKey) => equivalent(correctKey, key))));
  return { ...state, verdict };
}

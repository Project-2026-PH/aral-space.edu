import { describe, expect, it } from 'vitest';
import type { QuizQuestion } from '@quiz-creator/types';
import {
  createEnumerationState,
  finalizeEnumerationState,
  getAnswerIdentityKey,
  getEnumerationMetadata,
  projectEnumerationOptions,
  submitEnumerationAttempt
} from '../quizAnswerEvaluation';

function question(partial: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'enumeration-q',
    quiz_id: 'quiz-1',
    question_text: 'Name the items',
    options: [],
    correct_answer: 0,
    order_index: 0,
    question_type: 'enumeration',
    ...partial
  };
}

describe('enumeration contracts', () => {
  it('uses explicit terms and a numeric quota when legacy options are empty', () => {
    const metadata = getEnumerationMetadata(question({ answer_text: '3', answer_terms: [' A ', 'B', 'C'] }));
    expect(metadata.status).toBe('available');
    expect(metadata.total).toBe(3);
    expect(metadata.terms).toEqual(['A', 'B', 'C']);
  });

  it('distinguishes valid empty and malformed explicit term fields from missing fields', () => {
    expect(getEnumerationMetadata(question({ options: ['A', 'B'], answer_terms: null })).status).toBe('available');
    expect(getEnumerationMetadata(question({ options: ['A', 'B'], answer_terms: [] })).reason).toBe('missing_terms');
    expect(getEnumerationMetadata(question({ options: ['A', 'B'], answer_terms: ['A', 2 as unknown as string] })).reason).toBe('malformed_terms');
  });

  it('deduplicates equivalent canonical terms and distractor collisions', () => {
    const metadata = getEnumerationMetadata(question({
      answer_text: '1',
      answer_terms: ['World War II', ' world war 2 '],
      enumeration_distractors: ['World War 2', 'Other', ' other ']
    }));
    expect(metadata.status).toBe('available');
    expect(metadata.terms).toEqual(['World War II']);
    expect(metadata.distractors).toEqual(['Other']);
    expect(getAnswerIdentityKey('  WORLD   WAR 2 ')).toBe('world war 2');
  });

  it('marks insufficient, excess, and malformed keys unavailable', () => {
    expect(getEnumerationMetadata(question({ answer_text: '3', answer_terms: ['A', 'B'] })).reason).toBe('insufficient_terms');
    expect(getEnumerationMetadata(question({ answer_text: '2', answer_terms: ['A', 'B', 'C'] })).reason).toBe('excess_terms');
    expect(getEnumerationMetadata(question({ answer_text: '2', answer_terms: ['A', 'B'], enumeration_distractors: ['A', 1 as unknown as string] })).reason).toBe('malformed_distractors');
  });

  it('counts unique right and wrong attempts until quota completion', () => {
    const metadata = getEnumerationMetadata(question({ answer_text: '3', answer_terms: ['A', 'B', 'C'] }));
    let state = createEnumerationState(metadata);
    state = submitEnumerationAttempt(state, ' a ', metadata);
    expect(state.status).toBe('active');
    expect(submitEnumerationAttempt(state, 'A', metadata)).toBe(state);
    state = submitEnumerationAttempt(state, 'wrong', metadata);
    state = submitEnumerationAttempt(state, 'B', metadata);
    expect(state.status).toBe('complete');
    expect(finalizeEnumerationState(state, metadata).verdict).toBe(false);
    expect(state.attempts).toHaveLength(3);
  });

  it('projects deterministic terms and distractors', () => {
    const metadata = getEnumerationMetadata(question({ answer_text: '2', answer_terms: ['A', 'B'], enumeration_distractors: ['X'] }));
    expect(projectEnumerationOptions(metadata)).toEqual([
      { id: 'correct-0', text: 'A', isCorrect: true },
      { id: 'correct-1', text: 'B', isCorrect: true },
      { id: 'distractor-0', text: 'X', isCorrect: false }
    ]);
  });
});

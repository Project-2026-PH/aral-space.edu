import { describe, expect, it } from 'vitest';
import {
  areAnswersEquivalent,
  normalizeAnswerForComparison,
} from '../AnswerValidationService';

describe('AnswerValidationService', () => {
  it('normalizes case, accents, punctuation, and whitespace', () => {
    expect(areAnswersEquivalent('  SIGAW ng Pugad-Lawin  ', 'Sigaw ng Pugad Lawin')).toBe(true);
    expect(areAnswersEquivalent('Jose Rizál', 'Jose Rizal')).toBe(true);
  });

  it('accepts singular and plural variants', () => {
    expect(areAnswersEquivalent('theory', 'theories')).toBe(true);
    expect(areAnswersEquivalent('child', 'children')).toBe(true);
    expect(areAnswersEquivalent('knife', 'knives')).toBe(true);
  });

  it('accepts Roman numerals and English or Arabic number forms', () => {
    expect(areAnswersEquivalent('World War II', 'World War 2')).toBe(true);
    expect(areAnswersEquivalent('World War two', 'World War II')).toBe(true);
    expect(areAnswersEquivalent('First Republic', '1 Republic')).toBe(true);
    expect(normalizeAnswerForComparison('Henry VIII')).toBe('henry 8');
  });

  it('accepts one conservative typo in a meaningful word', () => {
    expect(areAnswersEquivalent('Photosynthesi', 'Photosynthesis')).toBe(true);
    expect(areAnswersEquivalent('Sigaw ng Pugad Lawin', 'Sigaw ng Pugad Lwawin')).toBe(true);
  });

  it('rejects substantially different answers', () => {
    expect(areAnswersEquivalent('Mitochondria', 'Chloroplast')).toBe(false);
    expect(areAnswersEquivalent('cat', 'dog')).toBe(false);
    expect(areAnswersEquivalent('', 'answer')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { buildClipboardQuestionPrompt } from '../clipboardQuestionPrompt';

describe('buildClipboardQuestionPrompt', () => {
  it('uses convertToQuestion when the definition contains the term', () => {
    expect(
      buildClipboardQuestionPrompt(
        'In matrix multiplication, rows are multiplied by columns.',
        'Matrix multiplication'
      )
    ).toBe('Here, rows are multiplied by columns. What is this operation called?');
  });

  it('uses the corrected naming predicate conversion for scalar definitions', () => {
    expect(
      buildClipboardQuestionPrompt(
        'Individual numbers (that are not part of a point or vector) are often called scalars',
        'scalars'
      )
    ).toBe('Individual numbers (that are not part of a point or vector) are often called what?');
  });

  it('uses the contextual fallback when the parser stripped the term', () => {
    expect(
      buildClipboardQuestionPrompt(
        'Describes the use of computers to create and manipulate images.',
        'computer graphics'
      )
    ).toBe('Describes the use of computers to create and manipulate images. What is this called?');
  });

  it('preserves existing question punctuation without adding a suffix', () => {
    expect(
      buildClipboardQuestionPrompt('In gravity, objects fall?', 'gravity')
    ).toBe('Here, objects fall?');
  });

  it('handles empty inputs without creating a prompt', () => {
    expect(buildClipboardQuestionPrompt('', 'term')).toBe('');
    expect(buildClipboardQuestionPrompt('   ', 'term')).toBe('   ');
    expect(buildClipboardQuestionPrompt('Some text.', '')).toBe('Some text.');
  });
});

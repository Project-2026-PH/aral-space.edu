import { describe, expect, it } from 'vitest';
import { convertToQuestion } from '../convertToQuestion';

describe('convertToQuestion', () => {
  it('converts the matrix multiplication example', () => {
    const text =
      'In matrix multiplication, you can only multiply matrices if the number of columns on the left-hand side matrix is equal to the number of rows on the righthand side matrix. In matrix multiplication we multiply the elements of each row of the first matrix by the elements of each column in the second matrix. Then, add the products.';

    expect(convertToQuestion(text, 'Matrix multiplication')).toBe(
      'Here, you can only multiply matrices if the number of columns on the left-hand side matrix is equal to the number of rows on the righthand side matrix. We also multiply the elements of each row of the first matrix by the elements of each column in the second matrix. Then, add the products. What is this operation called?'
    );
  });

  it.each(['In', 'With', 'During', 'For'])('handles the %s opener', (opener) => {
    expect(convertToQuestion(`${opener} photosynthesis, plants produce energy.`, 'photosynthesis')).toBe(
      'Here, plants produce energy. What is this operation called?'
    );
  });

  it('matches terms case-insensitively and respects word boundaries', () => {
    expect(convertToQuestion('IN Algebra, algebra uses symbols.', 'algebra')).toContain('Here,');
    expect(convertToQuestion('An algebraic expression is useful.', 'algebra')).toBe(
      'An algebraic expression is useful.'
    );
  });

  it('transforms predicate and repeated mentions', () => {
    expect(convertToQuestion('This is photosynthesis. Photosynthesis needs light.', 'photosynthesis')).toBe(
      'This is known as what. this process needs light. What is this operation called?'
    );
  });

  it('handles empty, absent, and already-question-ending input', () => {
    expect(convertToQuestion('', 'term')).toBe('');
    expect(convertToQuestion('Some text.', '   ')).toBe('Some text.');
    expect(convertToQuestion('Some text.', 'missing')).toBe('Some text.');
    expect(convertToQuestion('In gravity, objects fall?', 'gravity')).toBe('Here, objects fall?');
  });

  it('escapes punctuation in multi-word terms and never creates underscore blanks', () => {
    const result = convertToQuestion('In C++ programming, syntax matters.', 'C++ programming');
    expect(result).toBe('Here, syntax matters. What is this operation called?');
    expect(result).not.toContain('______');
  });
});

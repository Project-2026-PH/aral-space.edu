import { describe, expect, it } from 'vitest';
import { createAuthoringUndoHistory } from '../authoringUndo';

describe('createAuthoringUndoHistory', () => {
  it('restores a complete manual draft snapshot without sharing mutable state', () => {
    const history = createAuthoringUndoHistory<{
      term: string;
      questions: Array<{ question_text: string; options: string[]; correct_answer: number }>;
    }>();
    const before = {
      term: 'Midterm',
      questions: [{ question_text: 'What is this?', options: ['photosynthesis'], correct_answer: 0 }]
    };

    history.recordBeforeProgrammaticChange(before);
    before.questions[0].options[0] = 'changed after recording';

    expect(history.undoProgrammaticChange()).toEqual({
      term: 'Midterm',
      questions: [{ question_text: 'What is this?', options: ['photosynthesis'], correct_answer: 0 }]
    });
    expect(history.hasPendingSnapshot()).toBe(false);
  });

  it('restores a complete add/edit card snapshot', () => {
    const history = createAuthoringUndoHistory<{
      type: string;
      questionText: string;
      options: string[];
      correctAnswer: number;
      answerText: string;
      explanation: string;
    }>();
    history.recordBeforeProgrammaticChange({
      type: 'multiple_choice',
      questionText: 'Original prompt',
      options: ['A', 'B'],
      correctAnswer: 1,
      answerText: 'B',
      explanation: 'Original explanation'
    });

    expect(history.undoProgrammaticChange()).toEqual({
      type: 'multiple_choice',
      questionText: 'Original prompt',
      options: ['A', 'B'],
      correctAnswer: 1,
      answerText: 'B',
      explanation: 'Original explanation'
    });
  });

  it('does not change state when the history is empty', () => {
    const history = createAuthoringUndoHistory<{ value: string }>();

    expect(history.undoProgrammaticChange()).toBeUndefined();
    expect(history.hasPendingSnapshot()).toBe(false);
  });

  it('keeps only the newest bounded snapshots', () => {
    const history = createAuthoringUndoHistory<number>(2);
    history.recordBeforeProgrammaticChange(1);
    history.recordBeforeProgrammaticChange(2);
    history.recordBeforeProgrammaticChange(3);

    expect(history.undoProgrammaticChange()).toBe(3);
    expect(history.undoProgrammaticChange()).toBe(2);
    expect(history.undoProgrammaticChange()).toBeUndefined();
  });

  it('clears and invalidates pending snapshots', () => {
    const history = createAuthoringUndoHistory<string>();
    history.recordBeforeProgrammaticChange('before close');
    history.clear();
    expect(history.hasPendingSnapshot()).toBe(false);

    history.recordBeforeProgrammaticChange('before reset');
    history.invalidate();
    expect(history.undoProgrammaticChange()).toBeUndefined();
  });
});

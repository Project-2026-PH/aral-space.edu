import { describe, it, expect } from 'vitest';
import type { QuizQuestion } from '@quiz-creator/types';
import { QuizTransformService } from '../QuizTransformService';

function makeMockQuestion(id: string, text: string, answer: string): QuizQuestion {
  return {
    id,
    quiz_id: 'test-quiz',
    question_text: text,
    question_type: 'multiple_choice',
    options: [answer],
    correct_answer: 0,
    answer_text: answer,
    explanation: `Explanation for ${text}`,
    order_index: 0,
    created_at: '2026-01-01T00:00:00.000Z'
  };
}

describe('QuizTransformService.prepareQuestionsForOptions', () => {
  it('moves threshold to upcoming questions and wraps backwards for end questions', () => {
    const questions: QuizQuestion[] = [
      makeMockQuestion('q1', 'Term 1', 'Answer 1'),
      makeMockQuestion('q2', 'Term 2', 'Answer 2'),
      makeMockQuestion('q3', 'Term 3', 'Answer 3'),
      makeMockQuestion('q4', 'Term 4', 'Answer 4'),
      makeMockQuestion('q5', 'Term 5', 'Answer 5'),
      makeMockQuestion('q6', 'Term 6', 'Answer 6'),
      makeMockQuestion('q7', 'Term 7', 'Answer 7'),
      makeMockQuestion('q8', 'Term 8', 'Answer 8'),
      makeMockQuestion('q9', 'Term 9', 'Answer 9'),
      makeMockQuestion('q10', 'Term 10', 'Answer 10')
    ];

    const result = QuizTransformService.prepareQuestionsForOptions(questions, 4);

    // Question 1 (index 0): gets upcoming options (2, 3, 4)
    expect(result[0].options).toEqual(['Answer 1', 'Answer 2', 'Answer 3', 'Answer 4']);
    expect(result[0].correct_answer).toBe(0);

    // Question 5 (index 4): gets upcoming options (6, 7, 8)
    expect(result[4].options).toEqual(['Answer 5', 'Answer 6', 'Answer 7', 'Answer 8']);
    expect(result[4].correct_answer).toBe(0);

    // Question 8 (index 7): gets upcoming options 9, 10, then wraps to preceding (7)
    expect(result[7].options).toEqual(['Answer 8', 'Answer 9', 'Answer 10', 'Answer 7']);
    expect(result[7].correct_answer).toBe(0);

    // Question 10 (last question, index 9): retrieves from last numbers before it (9, 8, 7)
    expect(result[9].options).toEqual(['Answer 10', 'Answer 9', 'Answer 8', 'Answer 7']);
    expect(result[9].correct_answer).toBe(0);
  });

  it('preserves existing full options when question already has 4 options', () => {
    const question: QuizQuestion = {
      ...makeMockQuestion('q1', 'Term 1', 'Answer 1'),
      options: ['Answer 1', 'Custom 2', 'Custom 3', 'Custom 4']
    };

    const result = QuizTransformService.prepareQuestionsForOptions([question], 4);
    expect(result[0].options).toEqual(['Answer 1', 'Custom 2', 'Custom 3', 'Custom 4']);
  });
});

describe('QuizTransformService.paraphraseToStatement', () => {
  it('paraphrases "It involves..." definition with user example accurately', () => {
    const definition = 'It involves envisioning physical operations more effectively with information such as PLDT employing “paperless billing” to their customers and moving the process from a manual paper-based filing system to a central computerized database. It is an essential step to utilize the benefits of the marketspace fully.';
    const term = 'Stage 1:New Processes';

    const statement = QuizTransformService.paraphraseToStatement(definition, term);

    expect(statement).toBe(
      'Stage 1:New Processes involves envisioning physical operations more effectively with information such as PLDT employing “paperless billing” to their customers and moving the process from a manual paper-based filing system to a central computerized database. It is an essential step to utilize the benefits of the marketspace fully.'
    );
  });

  it('handles various linguistic definition patterns cleanly', () => {
    expect(QuizTransformService.paraphraseToStatement('Refers to the process of data parsing.', 'Tokenization')).toBe(
      'Tokenization refers to the process of data parsing.'
    );
    expect(QuizTransformService.paraphraseToStatement('It is defined as state preservation.', 'Snapshotting')).toBe(
      'Snapshotting is defined as state preservation.'
    );
    expect(QuizTransformService.paraphraseToStatement('The process of converting code to AST.', 'Parsing')).toBe(
      'Parsing is the process of converting code to AST.'
    );
    expect(QuizTransformService.paraphraseToStatement('What is spaced repetition?', 'Spaced Repetition')).toBe(
      'Spaced Repetition is spaced repetition.'
    );
  });

  it('strips enclosing quotes from question text if present', () => {
    const quoted = '"It involves envisioning physical operations more effectively."';
    expect(QuizTransformService.paraphraseToStatement(quoted, 'Stage 1')).toBe(
      'Stage 1 involves envisioning physical operations more effectively.'
    );
  });
});

describe('QuizTransformService.convertToTrueFalse & generateTrueFalseQuestions', () => {
  const exampleDef = 'It involves envisioning physical operations more effectively with information such as PLDT employing “paperless billing” to their customers and moving the process from a manual paper-based filing system to a central computerized database. It is an essential step to utilize the benefits of the marketspace fully.';

  it('creates a TRUE question using the exact term', () => {
    const q = makeMockQuestion('q1', exampleDef, 'Stage 1:New Processes');
    const result = QuizTransformService.convertToTrueFalse(q, true, ['Stage 2:New Marketplace']);

    expect(result.options).toEqual(['True', 'False']);
    expect(result.correct_answer).toBe(0);
    expect(result.answer_text).toBe('True');
    expect(result.question_text).toContain('Stage 1:New Processes involves');
  });

  it('creates a FALSE question by swapping with a distractor term', () => {
    const q = makeMockQuestion('q1', exampleDef, 'Stage 1:New Processes');
    const result = QuizTransformService.convertToTrueFalse(q, false, ['Stage 2:New Marketplace']);

    expect(result.options).toEqual(['True', 'False']);
    expect(result.correct_answer).toBe(1);
    expect(result.answer_text).toBe('False');
    expect(result.question_text).toContain('Stage 2:New Marketplace involves');
    expect(result.explanation).toContain('Stage 1:New Processes');
  });

  it('generates a balanced True/False deck across multiple questions', () => {
    const questions: QuizQuestion[] = [
      makeMockQuestion('q1', exampleDef, 'Stage 1:New Processes'),
      makeMockQuestion('q2', 'Refers to the electronic marketplace.', 'Stage 2:New Marketplace'),
      makeMockQuestion('q3', 'Defined as the final synthesis stage.', 'Stage 3:New Synthesis')
    ];

    const result = QuizTransformService.generateTrueFalseQuestions(questions);

    expect(result).toHaveLength(3);
    // Index 0 is True
    expect(result[0].correct_answer).toBe(0);
    expect(result[0].question_text).toContain('Stage 1:New Processes involves');

    // Index 1 is False (swapped with Stage 3 or Stage 1)
    expect(result[1].correct_answer).toBe(1);
    expect(result[1].question_text).not.toContain('Stage 2:New Marketplace refers to');
    expect(result[1].explanation).toContain('Stage 2:New Marketplace');

    // Index 2 is True
    expect(result[2].correct_answer).toBe(0);
    expect(result[2].question_text).toContain('Stage 3:New Synthesis is defined as');
  });
});

describe('QuizTransformService.phraseIdentificationPrompt', () => {
  it('paraphrases leading term sentences with "This deals with..."', () => {
    const res = QuizTransformService.phraseIdentificationPrompt(
      'Modeling deals with the mathematical specification of shape and appearance properties',
      'Modeling'
    );
    expect(res).toBe('This deals with the mathematical specification of shape and appearance properties');
  });

  it('paraphrases passive subject sentence into "This is stored in a region of memory"', () => {
    const res = QuizTransformService.phraseIdentificationPrompt(
      'Pixel data is stored in a region of memory',
      'framebuffer'
    );
    expect(res).toBe('This is stored in a region of memory');
  });
});

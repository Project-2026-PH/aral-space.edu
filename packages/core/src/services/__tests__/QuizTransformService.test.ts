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

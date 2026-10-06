import type { QuizQuestion } from '@quiz-creator/types';
import { getEnumerationMetadata } from './quizAnswerEvaluation';

export type LearnInteraction = 'enumeration' | 'true_false' | 'multiple_choice' | 'typed_answer';

function isTrueFalsePair(options: string[]): boolean {
  const values = options.map((value) => value.trim().toLocaleLowerCase());
  return values.length === 2 && values.includes('true') && values.includes('false');
}

export function getLearnInteraction(question: QuizQuestion): LearnInteraction {
  if (question.question_type === 'enumeration' && getEnumerationMetadata(question).status === 'available') return 'enumeration';
  if (question.question_type !== 'enumeration' && isTrueFalsePair(question.options)) return 'true_false';
  if (question.question_type === 'multiple_choice' && question.options.some((option) => option.trim())) return 'multiple_choice';
  if (question.question_type === 'typed_answer' || question.options.length === 0) return 'typed_answer';
  return 'typed_answer';
}

export function toTrueFalseQuestion(question: QuizQuestion): { question: QuizQuestion; sourceQuestionId: string } {
  return {
    sourceQuestionId: question.id,
    // Keep the source identity so mastery and explanations remain attached to
    // the original question while retaining all correctness metadata.
    question: { ...question, id: question.id, question_type: 'multiple_choice' }
  };
}

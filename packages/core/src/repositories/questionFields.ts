import { CreateQuestionDto, QuizQuestion, QuizQuestionType, UpdateQuestionDto } from '@quiz-creator/types';

export interface NormalizedQuestionFields {
  options: string[];
  correct_answer: number;
  answer_text: string | null;
  question_type: QuizQuestionType;
}

function normalizeOptions(options: unknown): string[] {
  return Array.isArray(options) ? options.map((option) => String(option)) : [];
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeQuestionFields(
  input: CreateQuestionDto | UpdateQuestionDto,
  existing?: Partial<QuizQuestion>
): NormalizedQuestionFields {
  const options = normalizeOptions(input.options !== undefined ? input.options : existing?.options);
  const suppliedCorrect = input.correct_answer !== undefined
    ? input.correct_answer
    : existing?.correct_answer;
  const candidateCorrect = typeof suppliedCorrect === 'number' && Number.isInteger(suppliedCorrect)
    ? suppliedCorrect
    : -1;

  const suppliedAnswer = input.answer_text !== undefined
    ? normalizedText(input.answer_text)
    : normalizedText(existing?.answer_text) || normalizedText(options[candidateCorrect]);
  const answerIndex = suppliedAnswer
    ? options.findIndex((option) => option.trim().toLowerCase() === suppliedAnswer.toLowerCase())
    : -1;
  const correctAnswer = candidateCorrect >= 0 && candidateCorrect < options.length
    ? candidateCorrect
    : answerIndex >= 0
      ? answerIndex
      : 0;

  const questionType = input.question_type || existing?.question_type || (
    options.length > 1 ? 'multiple_choice' : 'typed_answer'
  );

  return {
    options,
    correct_answer: correctAnswer,
    answer_text: suppliedAnswer,
    question_type: questionType
  };
}

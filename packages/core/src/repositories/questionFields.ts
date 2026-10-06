import { CreateQuestionDto, QuizQuestion, QuizQuestionType, UpdateQuestionDto } from '@quiz-creator/types';

export interface NormalizedQuestionFields {
  options: string[];
  answer_terms: string[] | null;
  enumeration_distractors: string[] | null;
  correct_answer: number;
  answer_text: string | null;
  question_type: QuizQuestionType;
  correct_explanation: string | null;
  distractor_explanations: Record<number, string> | null;
  discriminatory_keywords: string[] | null;
  concept_tags: string[] | null;
}

function normalizeOptions(options: unknown): string[] {
  return Array.isArray(options) ? options.map((option) => String(option).trim()) : [];
}

function normalizeStringList(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeDistractorExplanations(value: unknown): Record<number, string> | null {
  if (!value) return null;
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const result: Record<number, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const num = Number(k);
    if (!isNaN(num) && typeof v === 'string' && v.trim().length > 0) {
      result[num] = v.trim();
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function normalizeKeywords(value: unknown): string[] | null {
  if (!value) return null;
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  const list = parsed
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : null;
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

  const questionType = input.question_type || existing?.question_type || (
    options.length > 1 ? 'multiple_choice' : 'typed_answer'
  );

  const suppliedAnswer = input.answer_text !== undefined
    ? normalizedText(input.answer_text)
    : normalizedText(existing?.answer_text) || normalizedText(options[candidateCorrect]);
  const answerIndex = suppliedAnswer
    ? options.findIndex((option) => option.trim().toLowerCase() === suppliedAnswer.toLowerCase())
    : -1;
  const candidateOption = candidateCorrect >= 0 && candidateCorrect < options.length
    ? normalizedText(options[candidateCorrect])
    : null;
  const correctAnswer = candidateOption
    ? candidateCorrect
    : answerIndex >= 0
      ? answerIndex
      : 0;
  const answerText = questionType === 'multiple_choice'
    ? candidateOption || (answerIndex >= 0 ? normalizedText(options[answerIndex]) : suppliedAnswer)
    : suppliedAnswer || normalizedText(options[correctAnswer]);

  if (questionType === 'multiple_choice' && !answerText) {
    throw new Error('A multiple-choice question must include a correct answer, either in answer_text or a non-empty option.');
  }
  if (questionType === 'typed_answer' && !answerText) {
    throw new Error('A question must include a correct answer.');
  }

  const correctExplanation = input.correct_explanation !== undefined
    ? normalizedText(input.correct_explanation)
    : (existing?.correct_explanation !== undefined ? normalizedText(existing.correct_explanation) : normalizedText(input.explanation || existing?.explanation));

  const distractorExplanations = input.distractor_explanations !== undefined
    ? normalizeDistractorExplanations(input.distractor_explanations)
    : (existing?.distractor_explanations !== undefined ? normalizeDistractorExplanations(existing.distractor_explanations) : null);

  const discriminatoryKeywords = input.discriminatory_keywords !== undefined
    ? normalizeKeywords(input.discriminatory_keywords)
    : (existing?.discriminatory_keywords !== undefined ? normalizeKeywords(existing.discriminatory_keywords) : null);

  const conceptTags = input.concept_tags !== undefined
    ? normalizeKeywords(input.concept_tags)
    : (existing?.concept_tags !== undefined ? normalizeKeywords(existing.concept_tags) : null);

  const answerTerms = input.answer_terms !== undefined
    ? normalizeStringList(input.answer_terms)
    : (existing?.answer_terms === undefined ? null : normalizeStringList(existing.answer_terms));
  const enumerationDistractors = input.enumeration_distractors !== undefined
    ? normalizeStringList(input.enumeration_distractors)
    : (existing?.enumeration_distractors === undefined ? null : normalizeStringList(existing.enumeration_distractors));

  return {
    options,
    answer_terms: answerTerms,
    enumeration_distractors: enumerationDistractors,
    correct_answer: correctAnswer,
    answer_text: answerText,
    question_type: questionType,
    correct_explanation: correctExplanation,
    distractor_explanations: distractorExplanations,
    discriminatory_keywords: discriminatoryKeywords,
    concept_tags: conceptTags
  };
}

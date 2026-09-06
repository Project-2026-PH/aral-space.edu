import {
  CreateQuestionDto,
  CreateQuizDto,
  UpdateQuestionDto,
  UpdateQuizDto,
  UpdateShareConfigDto,
  UpdateSubjectShareConfigDto,
  QuizQuestionType,
  AuthoringPreferenceSignals,
  AuthoringQuestionType
} from '@quiz-creator/types';
import {
  assertPlainObject,
  boundedArray,
  boundedBoolean,
  boundedInteger,
  boundedString,
  RequestSecurityError
} from './request-security';

const QUESTION_TYPES = new Set<QuizQuestionType>(['multiple_choice', 'typed_answer']);
const AUTHORING_QUESTION_TYPES: AuthoringQuestionType[] = [
  'multiple_choice',
  'typed_answer',
  'identification',
  'true_false',
  'enumeration'
];

function parseAuthoringSignals(value: unknown): AuthoringPreferenceSignals | undefined {
  if (value === undefined || value === null) return undefined;
  const object = assertPlainObject(value, 'authoringSignals');
  const version = boundedInteger(object.version, 'authoringSignals.version', 1, 1, true)! as 1;
  const observationCount = boundedInteger(object.observationCount, 'authoringSignals.observationCount', 0, 500, true)!;
  const createCount = boundedInteger(object.createCount, 'authoringSignals.createCount', 0, 500, true)!;
  const editCount = boundedInteger(object.editCount, 'authoringSignals.editCount', 0, 500, true)!;
  const deleteCount = boundedInteger(object.deleteCount, 'authoringSignals.deleteCount', 0, 500, true)!;
  const averageQuestionLength = boundedInteger(object.averageQuestionLength, 'authoringSignals.averageQuestionLength', 0, 10_000, true)!;
  const averageOptionCount = boundedInteger(object.averageOptionCount, 'authoringSignals.averageOptionCount', 0, 20, true)!;
  const averageExplanationLength = boundedInteger(object.averageExplanationLength, 'authoringSignals.averageExplanationLength', 0, 10_000, true)!;
  const rawCounts = assertPlainObject(object.questionTypeCounts, 'authoringSignals.questionTypeCounts');
  const questionTypeCounts = {} as Record<AuthoringQuestionType, number>;

  for (const type of AUTHORING_QUESTION_TYPES) {
    questionTypeCounts[type] = boundedInteger(
      rawCounts[type],
      `authoringSignals.questionTypeCounts.${type}`,
      0,
      500,
      true
    )!;
  }

  return {
    version,
    observationCount,
    createCount,
    editCount,
    deleteCount,
    questionTypeCounts,
    averageQuestionLength,
    averageOptionCount,
    averageExplanationLength
  };
}

function optionalText(value: unknown, field: string, maxLength: number): string | null | undefined {
  if (value === null) return null;
  return boundedString(value, field, maxLength);
}

function optionalIntegerArray(value: unknown, field: string, maxLength: number, maxValue: number): number[] | null | undefined {
  if (value === null) return null;
  const values = boundedArray<unknown>(value, field, maxLength);
  if (values === undefined) return undefined;
  return values.map((item, index) => boundedInteger(item, `${field}[${index}]`, 0, maxValue, true)!);
}

function optionalStringArray(value: unknown, field: string, maxLength: number, itemLength: number): string[] | null | undefined {
  if (value === null) return null;
  const values = boundedArray<unknown>(value, field, maxLength);
  if (values === undefined) return undefined;
  return values.map((item, index) => boundedString(item, `${field}[${index}]`, itemLength, true)!);
}

function optionalExplanationMap(value: unknown, field: string): Record<number, string> | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const object = assertPlainObject(value, field);
  const entries = Object.entries(object);
  if (entries.length > 20) throw new RequestSecurityError(400, `${field} has too many entries`);
  const result: Record<number, string> = {};
  for (const [key, rawValue] of entries) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index > 100) throw new RequestSecurityError(400, `${field} has an invalid option index`);
    result[index] = boundedString(rawValue, `${field}.${key}`, 2_000, true)!;
  }
  return result;
}

export function parseQuestionInput(value: unknown, field = 'question', partial = false): CreateQuestionDto | UpdateQuestionDto {
  const object = assertPlainObject(value, field);
  const result: Record<string, unknown> = {};
  const questionText = boundedString(object.question_text, `${field}.question_text`, 10_000, !partial);
  if (questionText !== undefined) result.question_text = questionText;
  const answerText = optionalText(object.answer_text, `${field}.answer_text`, 10_000);
  if (answerText !== undefined) result.answer_text = answerText;
  const questionType = boundedString(object.question_type, `${field}.question_type`, 32);
  if (questionType !== undefined) {
    if (!QUESTION_TYPES.has(questionType as QuizQuestionType)) throw new RequestSecurityError(400, `${field}.question_type is invalid`);
    result.question_type = questionType;
  }
  const options = object.options === null ? null : boundedArray<unknown>(object.options, `${field}.options`, 20);
  if (options !== undefined) {
    if (options === null) result.options = null;
    else result.options = options.map((item, index) => boundedString(item, `${field}.options[${index}]`, 5_000, true)!);
  }
  const correctAnswer = boundedInteger(object.correct_answer, `${field}.correct_answer`, 0, 100);
  if (correctAnswer !== undefined) result.correct_answer = correctAnswer;
  const explanation = optionalText(object.explanation, `${field}.explanation`, 10_000);
  if (explanation !== undefined) result.explanation = explanation;
  const correctExplanation = optionalText(object.correct_explanation, `${field}.correct_explanation`, 10_000);
  if (correctExplanation !== undefined) result.correct_explanation = correctExplanation;
  const distractors = optionalExplanationMap(object.distractor_explanations, `${field}.distractor_explanations`);
  if (distractors !== undefined) result.distractor_explanations = distractors;
  const keywords = optionalStringArray(object.discriminatory_keywords, `${field}.discriminatory_keywords`, 50, 200);
  if (keywords !== undefined) result.discriminatory_keywords = keywords;
  const concepts = optionalStringArray(object.concept_tags, `${field}.concept_tags`, 50, 200);
  if (concepts !== undefined) result.concept_tags = concepts;
  const sourcePages = optionalIntegerArray(object.source_pages, `${field}.source_pages`, 100, 10_000);
  if (sourcePages !== undefined) result.source_pages = sourcePages;
  const orderIndex = boundedInteger(object.order_index, `${field}.order_index`, 0, 10_000);
  if (orderIndex !== undefined) result.order_index = orderIndex;
  return result as CreateQuestionDto | UpdateQuestionDto;
}

export function parseCreateQuestion(value: unknown): CreateQuestionDto {
  return parseQuestionInput(value, 'question') as CreateQuestionDto;
}

export function parseUpdateQuestion(value: unknown): UpdateQuestionDto {
  const result = parseQuestionInput(value, 'question', true) as UpdateQuestionDto;
  if (!Object.keys(result).length) throw new RequestSecurityError(400, 'At least one question field is required');
  return result;
}

export function parseSessionAnswer(value: Record<string, unknown>): {
  questionId: string;
  isCorrect: boolean;
  selectedOptionId?: number;
  answerText?: string;
  answerMode?: 'learn' | 'identification';
} {
  const questionId = boundedString(value.questionId, 'questionId', 128, true)!;
  const legacyIsCorrect = boundedBoolean(value.isCorrect, 'isCorrect');
  const selectedOptionId = boundedInteger(value.selectedOptionId, 'selectedOptionId', 0, 100);
  const answerText = boundedString(value.answerText, 'answerText', 2_000);
  const answerModeValue = boundedString(value.answerMode, 'answerMode', 32);
  if (answerModeValue !== undefined && answerModeValue !== 'learn' && answerModeValue !== 'identification') {
    throw new RequestSecurityError(400, 'answerMode is invalid');
  }

  const hasSubmittedAnswer = selectedOptionId !== undefined || answerText !== undefined;
  if (legacyIsCorrect === undefined && !hasSubmittedAnswer) {
    throw new RequestSecurityError(400, 'Either an answer or isCorrect is required');
  }

  return {
    questionId,
    isCorrect: legacyIsCorrect ?? false,
    selectedOptionId,
    answerText,
    answerMode: answerModeValue as 'learn' | 'identification' | undefined
  };
}

export function parseCreateQuiz(value: unknown): CreateQuizDto {
  const object = assertPlainObject(value);
  const title = boundedString(object.title, 'title', 200, true)!;
  const description = optionalText(object.description, 'description', 10_000);
  const subjectId = optionalText(object.subject_id, 'subject_id', 128);
  const handoutName = optionalText(object.handout_name, 'handout_name', 500);
  const sourceModel = boundedString(object.source_model, 'source_model', 100);
  const questions = boundedArray<unknown>(object.questions, 'questions', 100);
  if (!questions) throw new RequestSecurityError(400, 'questions is required');
  return {
    title,
    description,
    subject_id: subjectId,
    handout_name: handoutName,
    source_model: sourceModel,
    questions: questions.map((question, index) => parseQuestionInput(question, `questions[${index}]`) as CreateQuestionDto)
  };
}

export function parseUpdateQuiz(value: unknown): UpdateQuizDto {
  const object = assertPlainObject(value);
  const result: UpdateQuizDto = {};
  const title = boundedString(object.title, 'title', 200);
  if (title !== undefined) result.title = title;
  const description = optionalText(object.description, 'description', 10_000);
  if (description !== undefined) result.description = description;
  const subjectId = optionalText(object.subject_id, 'subject_id', 128);
  if (subjectId !== undefined) result.subject_id = subjectId;
  if (!Object.keys(result).length) throw new RequestSecurityError(400, 'At least one quiz field is required');
  return result;
}

function parseExpiry(value: unknown, field: string): string | null | undefined {
  if (value === null) return null;
  const text = boundedString(value, field, 64);
  if (text === undefined) return undefined;
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) throw new RequestSecurityError(400, `${field} must be a valid timestamp`);
  if (timestamp <= Date.now()) throw new RequestSecurityError(400, `${field} must be in the future`);
  return new Date(timestamp).toISOString();
}

export function parseShareConfig(value: unknown): UpdateShareConfigDto {
  const object = assertPlainObject(value);
  const result: UpdateShareConfigDto = {};
  const isPublic = boundedBoolean(object.is_public, 'is_public');
  if (isPublic !== undefined) result.is_public = isPublic;
  const allowCloning = boundedBoolean(object.allow_cloning, 'allow_cloning');
  if (allowCloning !== undefined) result.allow_cloning = allowCloning;
  const allowAnswerKey = boundedBoolean(object.allow_public_answer_key, 'allow_public_answer_key');
  if (allowAnswerKey !== undefined) result.allow_public_answer_key = allowAnswerKey;
  const resetToken = boundedBoolean(object.reset_token, 'reset_token');
  if (resetToken !== undefined) result.reset_token = resetToken;
  const expires = parseExpiry(object.share_expires_at, 'share_expires_at');
  if (expires !== undefined) result.share_expires_at = expires;
  if (!Object.keys(result).length) throw new RequestSecurityError(400, 'At least one share setting is required');
  return result;
}

export function parseSubjectShareConfig(value: unknown): UpdateSubjectShareConfigDto {
  const object = assertPlainObject(value);
  const result: UpdateSubjectShareConfigDto = {};
  const isPublic = boundedBoolean(object.is_public, 'is_public');
  if (isPublic !== undefined) result.is_public = isPublic;
  const resetToken = boundedBoolean(object.reset_token, 'reset_token');
  if (resetToken !== undefined) result.reset_token = resetToken;
  const expires = parseExpiry(object.share_expires_at, 'share_expires_at');
  if (expires !== undefined) result.share_expires_at = expires;
  if (!Object.keys(result).length) throw new RequestSecurityError(400, 'At least one share setting is required');
  return result;
}

export function parseGenerateQuizRequest(value: unknown) {
  const object = assertPlainObject(value);
  const title = boundedString(object.title, 'title', 200);
  const subjectId = boundedString(object.subjectId, 'subjectId', 128);
  const handoutName = boundedString(object.handoutName, 'handoutName', 500);
  const handoutPath = boundedString(object.handoutPath, 'handoutPath', 1_000);
  const text = boundedString(object.text, 'text', 2_000_000);
  const pageStart = boundedInteger(object.pageStart, 'pageStart', 1, 10_000);
  const pageEnd = boundedInteger(object.pageEnd, 'pageEnd', 1, 10_000);
  if (pageStart !== undefined && pageEnd !== undefined && pageStart > pageEnd) {
    throw new RequestSecurityError(400, 'pageStart must not be greater than pageEnd');
  }
  const pipelineMode = boundedString(object.pipelineMode, 'pipelineMode', 32);
  const allowedModes = new Set(['auto', 'two_stage', 'groq_direct', 'gemini_direct', 'verbatim_exact']);
  if (pipelineMode !== undefined && !allowedModes.has(pipelineMode)) {
    throw new RequestSecurityError(400, 'pipelineMode is invalid');
  }
  const pagesValue = boundedArray<unknown>(object.pdfPages, 'pdfPages', 100);
  const pdfPages = pagesValue?.map((rawPage, index) => {
    const page = assertPlainObject(rawPage, `pdfPages[${index}]`);
    return {
      pageNumber: boundedInteger(page.pageNumber, `pdfPages[${index}].pageNumber`, 1, 10_000, true)!,
      text: boundedString(page.text, `pdfPages[${index}].text`, 100_000, true)!,
      chapterTitle: boundedString(page.chapterTitle, `pdfPages[${index}].chapterTitle`, 500)
    };
  });
  if (pdfPages && pdfPages.reduce((total, page) => total + page.text.length, 0) > 2_000_000) {
    throw new RequestSecurityError(413, 'The total document text is too large');
  }
  const filesValue = boundedArray<unknown>(object.filesSummary, 'filesSummary', 20);
  const filesSummary = filesValue?.map((rawFile, index) => {
    const file = assertPlainObject(rawFile, `filesSummary[${index}]`);
    return {
      fileName: boundedString(file.fileName, `filesSummary[${index}].fileName`, 500, true)!,
      pageCount: boundedInteger(file.pageCount, `filesSummary[${index}].pageCount`, 0, 10_000, true)!,
      fileSize: boundedInteger(file.fileSize, `filesSummary[${index}].fileSize`, 0, 10 * 1024 * 1024)
    };
  });

  return {
    subjectId,
    title,
    handoutName,
    handoutPath,
    text,
    pdfPages,
    filesSummary,
    pageStart,
    pageEnd,
    pipelineMode,
    // Provider credentials and prompt exemplars remain server-authoritative.
    authoringProfile: undefined,
    authoringSignals: parseAuthoringSignals(object.authoringSignals)
  };
}

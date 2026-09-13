import type {
  GeneratedReviewerItem,
  ParsedPage,
  ReviewerGenerationOptions,
  ReviewerQuestionType
} from '@quiz-creator/types';

export interface ValidatedReviewerItem extends GeneratedReviewerItem {
  options: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokens(value: string): string[] {
  return Array.from(new Set(
    normalize(value).match(/[a-z0-9]{3,}/g) || []
  ));
}

function answerMatchesOption(answer: string, option: string): boolean {
  return normalize(answer) === normalize(option);
}

function meaningfulTokens(value: string): string[] {
  return tokens(value).filter((token) => ![
    'true', 'false', 'what', 'which', 'when', 'where', 'why', 'how',
    'does', 'did', 'the', 'are', 'was', 'were', 'this', 'that', 'and'
  ].includes(token));
}

function hasSourceSupport(item: GeneratedReviewerItem, pageTexts: string[]): boolean {
  const evidence = normalize(item.evidenceExcerpt);
  if (!evidence) return false;

  // Evidence must be an exact contiguous excerpt from one cited page. Checking
  // the complete page range would allow an excerpt to be assembled across page
  // boundaries and would make the citation misleading.
  const evidencePage = pageTexts.find((pageText) => normalize(pageText).includes(evidence));
  if (!evidencePage) return false;

  const answer = normalize(item.answer);
  const questionTokens = meaningfulTokens(item.question);
  const answerSupported = item.questionType === 'true_false'
    ? questionTokens.length > 0 && questionTokens.every((token) => evidence.includes(token))
    : answer.length >= 3 && evidence.includes(answer);
  const questionSupported = questionTokens.length > 0
    && questionTokens.every((token) => evidence.includes(token));
  return answerSupported && questionSupported;
}

function isDuplicateQuestion(question: string, existing: string[]): boolean {
  const candidate = new Set(meaningfulTokens(question));
  if (candidate.size === 0) return existing.some((item) => normalize(item) === normalize(question));

  return existing.some((previous) => {
    const prior = new Set(meaningfulTokens(previous));
    const intersection = Array.from(candidate).filter((token) => prior.has(token)).length;
    const smallerSet = Math.max(1, Math.min(candidate.size, prior.size));
    const union = new Set([...candidate, ...prior]).size;
    return intersection / smallerSet >= 0.8 || intersection / Math.max(1, union) >= 0.65;
  });
}

export class ReviewerItemValidationService {
  validate(
    items: GeneratedReviewerItem[],
    pages: ParsedPage[],
    options: ReviewerGenerationOptions
  ): ValidatedReviewerItem[] {
    if (!Array.isArray(items) || pages.length === 0) throw new Error('No reviewer items were generated');

    const pageNumbers = new Set(pages.map((page) => page.pageNumber));
    const accepted: ValidatedReviewerItem[] = [];
    const seenQuestions: string[] = [];
    const seenEvidence = new Set<string>();

    for (const raw of items) {
      if (!raw || typeof raw.question !== 'string' || raw.question.trim().length < 8) continue;
      if (!options.questionTypes.includes(raw.questionType)) continue;
      if (!raw || typeof raw.answer !== 'string' || raw.answer.trim().length === 0) continue;
      if (!Number.isInteger(raw.sourcePageStart) || !Number.isInteger(raw.sourcePageEnd)) continue;
      if (raw.sourcePageStart > raw.sourcePageEnd || !pageNumbers.has(raw.sourcePageStart) || !pageNumbers.has(raw.sourcePageEnd)) continue;
      if (typeof raw.evidenceExcerpt !== 'string' || raw.evidenceExcerpt.trim().length < 12) continue;
      if (options.difficulty !== 'mixed' && raw.difficulty !== options.difficulty) continue;
      if (isDuplicateQuestion(raw.question, seenQuestions)) continue;
      const evidenceKey = normalize(raw.evidenceExcerpt);
      if (seenEvidence.has(evidenceKey)) continue;

      const citedPages = pages.filter((page) => page.pageNumber >= raw.sourcePageStart && page.pageNumber <= raw.sourcePageEnd);
      if (!hasSourceSupport(raw, citedPages.map((page) => page.text))) continue;

      const normalized: ValidatedReviewerItem = {
        questionType: raw.questionType,
        question: raw.question.trim(),
        answer: raw.answer.trim(),
        explanation: raw.explanation?.trim() || undefined,
        options: Array.isArray(raw.options) ? raw.options.map((option) => String(option).trim()).filter(Boolean) : [],
        difficulty: raw.difficulty,
        sourcePageStart: raw.sourcePageStart,
        sourcePageEnd: raw.sourcePageEnd,
        evidenceExcerpt: raw.evidenceExcerpt.trim()
      };

      if (normalized.questionType === 'multiple_choice') {
        if (normalized.options.length < 2 || normalized.options.length > 6) continue;
        if (!normalized.options.some((option) => answerMatchesOption(normalized.answer, option))) continue;
      } else if (normalized.questionType === 'true_false') {
        const answer = normalize(normalized.answer);
        if (answer !== 'true' && answer !== 'false') continue;
        normalized.answer = answer === 'true' ? 'True' : 'False';
        normalized.options = ['True', 'False'];
      } else if (normalized.options.length > 0) {
        normalized.options = [];
      }

      seenQuestions.push(normalized.question);
      seenEvidence.add(evidenceKey);
      accepted.push(normalized);
      if (accepted.length >= options.questionCount) break;
    }

    if (accepted.length !== options.questionCount) {
      throw new Error(`Only ${accepted.length} of ${options.questionCount} reviewer items passed source-grounded validation`);
    }

    const requiredTypes = new Set<ReviewerQuestionType>(options.questionTypes);
    if (options.questionCount >= requiredTypes.size) {
      for (const type of requiredTypes) {
        if (!accepted.some((item) => item.questionType === type)) {
          throw new Error(`The generated reviewer set did not include a valid ${type} item`);
        }
      }
    }

    return accepted;
  }
}

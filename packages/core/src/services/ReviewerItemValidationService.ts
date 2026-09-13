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
  return value
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/([a-z])-\s+(?=[a-z])/gi, '$1')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
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
    'does', 'did', 'the', 'are', 'was', 'were', 'this', 'that', 'and',
    'according', 'following', 'statement', 'statements', 'best', 'describe',
    'describes', 'identify', 'identifies', 'identified', 'based', 'provided',
    'information', 'concept', 'concepts', 'term', 'terms', 'characteristic',
    'characteristics', 'example', 'examples', 'correct', 'answer', 'option',
    'options', 'source', 'excerpt', 'document', 'material', 'principle',
    'definition', 'refers', 'refer', 'means', 'meant', 'called', 'known',
    'likely', 'primarily', 'main', 'primary', 'purpose', 'role', 'feature',
    'features', 'following', 'statement'
  ].includes(token));
}

function cleanEvidenceExcerpt(value: string): string {
  return value
    .trim()
    .replace(/^```(?:text|quote)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^\s*(?:evidence(?:\s+excerpt)?|quote)\s*:\s*/i, '')
    .replace(/^\s*[>\-*]\s*/, '')
    .replace(/^["'“`]+/, '')
    .replace(/["'”`]+$/, '')
    .trim();
}

function tokenVariants(token: string): string[] {
  const variants = new Set([token, `${token}s`, `${token}es`]);
  if (token.endsWith('y')) variants.add(`${token.slice(0, -1)}ies`);
  if (token.endsWith('x')) variants.add(`${token.slice(0, -1)}ces`);
  return Array.from(variants);
}

function containsSourceToken(source: string, token: string): boolean {
  const words = new Set(source.match(/[a-z0-9]{3,}/g) || []);
  return tokenVariants(token).some((variant) => words.has(variant));
}

function answerIsSupported(answer: string, evidence: string): boolean {
  const normalizedAnswer = normalize(answer);
  if (normalizedAnswer.length < 3) return false;
  if (evidence.includes(normalizedAnswer)) return true;

  // Some valid answers include punctuation or a small amount of wording that
  // differs from the citation. Require every meaningful answer term instead
  // of accepting an unrelated partial match.
  const answerTokens = meaningfulTokens(answer);
  return answerTokens.length > 0 && answerTokens.every((token) => containsSourceToken(evidence, token));
}

function hasSourceSupport(item: GeneratedReviewerItem, pageTexts: string[]): boolean {
  const evidence = normalize(cleanEvidenceExcerpt(item.evidenceExcerpt));
  if (!evidence) return false;

  // Evidence must be an exact contiguous excerpt from one cited page. Matching
  // is whitespace/Unicode tolerant because PDF extraction can insert line
  // breaks, soft hyphens, curly quotes, or typographic dashes.
  const evidencePage = pageTexts.find((pageText) => normalize(pageText).includes(evidence));
  if (!evidencePage) return false;

  const sourceText = normalize(evidencePage);
  const questionTokens = meaningfulTokens(item.question);
  const questionTokensInSource = questionTokens.filter((token) => containsSourceToken(sourceText, token));
  const minimumQuestionOverlap = Math.max(1, Math.ceil(questionTokens.length * 0.6));
  const questionSupported = questionTokens.length > 0
    && questionTokensInSource.length >= minimumQuestionOverlap;

  // The citation, rather than the question's generic wording, is the
  // authoritative support for the answer. True/false answers are handled by
  // the source terms in the question because "True"/"False" are not source
  // facts themselves.
  const answerSupported = item.questionType === 'true_false'
    ? questionSupported
    : answerIsSupported(item.answer, evidence);

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
      if (typeof raw.evidenceExcerpt !== 'string') continue;
      const evidenceExcerpt = cleanEvidenceExcerpt(raw.evidenceExcerpt);
      if (evidenceExcerpt.length < 12) continue;
      if (options.difficulty !== 'mixed' && raw.difficulty !== options.difficulty) continue;
      if (isDuplicateQuestion(raw.question, seenQuestions)) continue;
      const evidenceKey = normalize(evidenceExcerpt);
      if (seenEvidence.has(evidenceKey)) continue;

      const citedPages = pages.filter((page) => page.pageNumber >= raw.sourcePageStart && page.pageNumber <= raw.sourcePageEnd);
      if (!hasSourceSupport({ ...raw, evidenceExcerpt }, citedPages.map((page) => page.text))) continue;

      const normalized: ValidatedReviewerItem = {
        questionType: raw.questionType,
        question: raw.question.trim(),
        answer: raw.answer.trim(),
        explanation: raw.explanation?.trim() || undefined,
        options: Array.isArray(raw.options) ? raw.options.map((option) => String(option).trim()).filter(Boolean) : [],
        difficulty: raw.difficulty,
        sourcePageStart: raw.sourcePageStart,
        sourcePageEnd: raw.sourcePageEnd,
        evidenceExcerpt
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

import { HandoutPage, RawAiQuestion } from '@quiz-creator/types';

export interface LocalConcept {
  term: string;
  definition: string;
  sourcePages: number[];
  chapter?: string;
  confidence: number;
  evidence: 'delimiter' | 'sentence' | 'wrapped' | 'compound' | 'naming';
  parentTerm?: string;
  relation?: 'form' | 'type' | 'component' | 'step';
  namingRelation?: 'called' | 'known_as' | 'referred_to_as';
  namingSubject?: string;
  namingContext?: string;
}

interface ConceptCandidate extends LocalConcept {
  order: number;
}

const TERM_SHAPE = /^[A-Z0-9][A-Za-z0-9\s.\-_/()&'’]*$/;
const BULLET_PREFIX = /^(?:[•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[a-zA-Z][.)])\s+/;
const SENTENCE_VERB = /^(?:is|are|was|were|refers to|means|describes|defines|consists of|includes|allows|provides|represents|denotes)\s+/i;
const NAMING_RELATION = /\b(?:is|are|was|were)\s+(called|known as|referred to as)\b/i;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it',
  'of', 'on', 'or', 'that', 'the', 'their', 'this', 'to', 'used', 'with'
]);

const SAFE_FALLBACK_DISTRACTORS = [
  'A related concept not explicitly defined in this material',
  'An example rather than the defined term',
  'A different idea from the same subject area'
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripBullet(value: string): string {
  return value.replace(BULLET_PREFIX, '').replace(/^\*\*|\*\*$/g, '').trim();
}

function normalizeTerm(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^\*+|\*+$/g, '')
    .replace(/^(?:a|an|the)\s+/i, '')
    .trim();
}

function isValidTerm(value: string): boolean {
  const term = normalizeTerm(value);
  if (!TERM_SHAPE.test(term)) return false;
  if (term.length < 2 || term.length > 80) return false;
  if (term.split(/\s+/).length > 10) return false;
  if (/^(?:note|example|definition|introduction|overview|summary|references?)$/i.test(term)) return false;
  return !/\b(?:is|are|was|were|refers|means|includes|consists|provides)\b/i.test(term);
}

function cleanDefinition(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^[:\-–—]\s*/, '')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function isDefinitionLike(value: string): boolean {
  const text = cleanDefinition(value);
  return text.length > 12 && (
    /^[a-z]/.test(text) ||
    /^(?:a|an|the)\s+/i.test(text) ||
    SENTENCE_VERB.test(text)
  );
}

function splitDelimitedLine(value: string): { term: string; definition: string } | null {
  const body = stripBullet(value);
  const match = body.match(/^(.{2,80}?)(?:\s*:\s*|\s+[–—-]\s+)([\s\S]+)$/);
  if (!match || !isValidTerm(match[1])) return null;
  const definition = cleanDefinition(match[2]);
  return definition.length > 5 ? { term: normalizeTerm(match[1]), definition } : null;
}

function splitSentenceDefinition(value: string): { term: string; definition: string } | null {
  const body = stripBullet(value).replace(/[.!?]+$/, '').trim();
  const match = body.match(/^(.{2,70}?)\s+(is|are|was|were|refers to|means|describes|defines|consists of|includes|allows|provides|represents|denotes)\s+(.+)$/i);
  if (!match || !isValidTerm(match[1])) return null;
  const definition = cleanDefinition(match[3]);
  return definition.length > 8 ? { term: normalizeTerm(match[1]), definition } : null;
}

interface NamingConceptPair {
  term: string;
  definition: string;
  subject: string;
  context?: string;
  relation: 'called' | 'known_as' | 'referred_to_as';
}

function cleanNamingTerm(value: string): string {
  return value
    .replace(/[.!?]+$/, '')
    .replace(/^["“'‘]+|["”'’]+$/g, '')
    .replace(/["“”'‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNamingDefinition(value: string, previousSentence?: string): NamingConceptPair | null {
  const body = stripBullet(value).replace(/[.!?]+$/, '').trim();
  const match = body.match(/^(.{2,160}?)\s+(?:is|are|was|were)\s+(called|known as|referred to as)\s+(.+)$/i);
  if (!match) return null;

  const term = cleanNamingTerm(match[3]);
  const subject = normalizeWhitespace(match[1]).replace(/^(?:such|these|those)\s+/i, '').trim();
  if (!isNestedTerm(term) || subject.length < 5 || subject.length > 140) return null;

  const relation = match[2].toLowerCase() === 'called'
    ? 'called'
    : match[2].toLowerCase() === 'known as'
      ? 'known_as'
      : 'referred_to_as';
  const context = /^(?:such|these|those)\b/i.test(match[1]) && previousSentence
    ? cleanDefinition(previousSentence)
    : undefined;
  const definition = cleanDefinition([context, `${subject}.`].filter(Boolean).join(' '));

  return definition.length > 8 ? { term, definition, subject, context, relation } : null;
}

function extractNamingDefinitions(value: string): NamingConceptPair[] {
  const sentences = splitSentences(normalizeWhitespace(value));
  const pairs: NamingConceptPair[] = [];

  for (let index = 0; index < sentences.length; index++) {
    const pair = splitNamingDefinition(sentences[index], sentences[index - 1]);
    if (pair && !pairs.some((existing) => existing.term.toLowerCase() === pair.term.toLowerCase())) {
      pairs.push(pair);
    }
  }

  return pairs;
}

function looksLikeStandaloneTerm(value: string): boolean {
  const term = stripBullet(value);
  return isValidTerm(term) && !/[,:;.!?]$/.test(term) && term.split(/\s+/).length <= 8;
}

function conceptKey(term: string, definition: string): string {
  return `${normalizeTerm(term).toLowerCase()}|${definition.toLowerCase()}`;
}

interface CompoundConceptGroup {
  parent: LocalConcept;
  children: LocalConcept[];
  relation: 'form' | 'type' | 'component' | 'step';
}

const COMPOUND_GROUP_CUE = /\b(?:has|have|contains?|includes?)\s+(two|three|four|five|\d+)\s*(?:\(\s*\d+\s*\)\s*)?(forms?|types?|categories?|kinds?|stages?)\s*:\s*([^.!?]+)/i;
const COMPOUND_COUNT_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5
};
const NESTED_TERM_SHAPE = /^[A-Za-z0-9][A-Za-z0-9\s\-_/()&'’]*$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isNestedTerm(value: string): boolean {
  const term = normalizeWhitespace(value).replace(/^(?:a|an|the)\s+/i, '').trim();
  if (!NESTED_TERM_SHAPE.test(term) || term.length < 3 || term.length > 60) return false;
  if (term.split(/\s+/).length > 6) return false;
  return !/\b(?:is|are|was|were|involves|refers|means|includes|consists|provides)\b/i.test(term);
}

function splitCompoundLabels(value: string, expectedCount: number): string[] {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[.;]+$/, '')
    .split(/\s*(?:,|;|\band\b|\bor\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => isNestedTerm(part))
    .slice(0, expectedCount);
}

function splitSentences(value: string): string[] {
  return value.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
}

function containsExactTerm(value: string, term: string): boolean {
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, 'i');
  return pattern.test(value);
}

function redactTerm(value: string, term: string): string {
  const escapedTerm = escapeRegExp(term);
  const replacement = /association$/i.test(term) ? 'this type of association' : 'this concept';
  const withArticle = new RegExp(`\\b(?:a|an|the)\\s+${escapedTerm}(?![A-Za-z0-9])`, 'gi');
  const exactTerm = new RegExp(`(^|[^A-Za-z0-9])${escapedTerm}(?![A-Za-z0-9])`, 'gi');
  return value
    .replace(withArticle, replacement)
    .replace(exactTerm, '$1' + replacement)
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCompoundGroup(parent: LocalConcept): CompoundConceptGroup | null {
  const match = parent.definition.match(COMPOUND_GROUP_CUE);
  if (!match) return null;

  const expectedCount = COMPOUND_COUNT_WORDS[match[1].toLowerCase()] || Number(match[1]);
  if (!Number.isFinite(expectedCount) || expectedCount < 2) return null;

  const childTerms = splitCompoundLabels(match[3], expectedCount);
  if (childTerms.length < 2 || childTerms.length !== expectedCount) return null;

  const sentences = splitSentences(parent.definition);
  const cueSentenceIndex = sentences.findIndex((sentence) => COMPOUND_GROUP_CUE.test(sentence));
  if (cueSentenceIndex < 0) return null;

  const anchorIndices = childTerms.map((term) => sentences.findIndex(
    (sentence, index) => index > cueSentenceIndex && containsExactTerm(sentence, term)
  ));
  if (anchorIndices.some((index) => index < 0) || new Set(anchorIndices).size !== anchorIndices.length) return null;

  const children = childTerms.map((term, index) => {
    const start = anchorIndices[index];
    const end = anchorIndices
      .filter((anchor) => anchor > start)
      .sort((a, b) => a - b)[0] ?? sentences.length;
    const definition = sentences
      .slice(start, end)
      .join(' ')
      .replace(/^(?:on the other hand|however|in contrast),?\s*/i, '')
      .trim();

    if (definition.length <= term.length + 12) return null;

    return {
      term,
      definition,
      sourcePages: parent.sourcePages,
      chapter: parent.chapter,
      confidence: Math.min(0.94, parent.confidence * 0.95),
      evidence: 'compound' as const,
      parentTerm: parent.term,
      relation: 'form' as const
    };
  });

  if (children.some((child) => child === null)) return null;
  return { parent, children: children as LocalConcept[], relation: 'form' };
}

function compoundQuestionStem(concept: LocalConcept): string {
  const definition = redactTerm(concept.definition, concept.term).replace(/[.!?]+$/, '');
  return `Which concept is described by: ${lowerFirst(definition)}?`;
}

function namingQuestionStem(concept: LocalConcept): string {
  const context = redactTerm(concept.namingContext || concept.definition, concept.term).replace(/[.!?]+$/, '');
  const subject = concept.namingSubject || 'these items';
  return `${context}. What are ${subject} called?`;
}

function buildEnumerationQuestion(
  group: CompoundConceptGroup,
  allConcepts: LocalConcept[]
): RawAiQuestion {
  const childTerms = group.children.map((child) => child.term);
  const correct = childTerms.join(', ');
  const otherTerms = allConcepts
    .filter((concept) => !childTerms.some((term) => term.toLowerCase() === concept.term.toLowerCase()))
    .map((concept) => concept.term);
  const alternatives = [
    childTerms.slice().reverse().join(', '),
    `${childTerms[0]}, ${otherTerms[0] || 'an unrelated concept'}`,
    `${childTerms[1]}, ${otherTerms[1] || 'another unrelated concept'}`
  ];
  const options: string[] = [];
  for (const option of [correct, ...alternatives, ...SAFE_FALLBACK_DISTRACTORS]) {
    if (!options.some((existing) => existing.toLowerCase() === option.toLowerCase())) {
      options.push(option);
    }
    if (options.length === 4) break;
  }

  return {
    question: 'Which pair lists the two forms of this threat?',
    options,
    correct_answer: options.findIndex((option) => option.toLowerCase() === correct.toLowerCase()),
    explanation: `The two forms of ${group.parent.term} are ${correct}.`,
    correct_explanation: `The source identifies ${correct} as the two forms of ${group.parent.term}.`,
    source_pages: group.parent.sourcePages,
    chapter: group.parent.chapter,
    discriminatory_keywords: childTerms
  };
}

function chapterName(chapter?: string): string | undefined {
  if (!chapter?.trim()) return undefined;
  return chapter.replace(/\.(?:pdf|txt|md)$/i, '').trim();
}

function addCandidate(
  candidates: ConceptCandidate[],
  pair: { term: string; definition: string },
  page: HandoutPage,
  evidence: LocalConcept['evidence'],
  order: number
): void {
  const term = normalizeTerm(pair.term);
  const definition = cleanDefinition(pair.definition);
  if (!isValidTerm(term) || definition.length <= 5) return;
  if (candidates.some((candidate) => conceptKey(candidate.term, candidate.definition) === conceptKey(term, definition))) {
    return;
  }
  candidates.push({
    term,
    definition,
    sourcePages: [page.pageNumber],
    chapter: chapterName(page.chapterTitle),
    confidence: evidence === 'delimiter' ? 0.98 : evidence === 'sentence' ? 0.9 : 0.8,
    evidence,
    order
  });
}

function addNamingCandidate(
  candidates: ConceptCandidate[],
  pair: NamingConceptPair,
  page: HandoutPage,
  order: number
): void {
  const term = normalizeWhitespace(pair.term);
  const definition = cleanDefinition(pair.definition);
  if (!isNestedTerm(term) || definition.length <= 8) return;
  if (candidates.some((candidate) => conceptKey(candidate.term, candidate.definition) === conceptKey(term, definition))) {
    return;
  }

  candidates.push({
    term,
    definition,
    sourcePages: [page.pageNumber],
    chapter: chapterName(page.chapterTitle),
    confidence: 0.95,
    evidence: 'naming',
    namingRelation: pair.relation,
    namingSubject: pair.subject,
    namingContext: pair.context,
    order
  });
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((token) => !STOP_WORDS.has(token)) || [];
}

function stableDistractorOrder(correct: LocalConcept, candidates: LocalConcept[]): LocalConcept[] {
  const definitionTokens = new Set(tokenize(correct.definition));
  return candidates
    .filter((candidate) => candidate.term.toLowerCase() !== correct.term.toLowerCase())
    .map((candidate, index) => ({
      candidate,
      index,
      score: tokenize(candidate.term).reduce((score, token) => score + (definitionTokens.has(token) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.candidate);
}

function isPlural(term: string): boolean {
  return /[^s]s$/i.test(term) && !/(?:ss|is|us)$/i.test(term);
}

function lowerFirst(value: string): string {
  return value.length > 0 ? value[0].toLowerCase() + value.slice(1) : value;
}

function questionStem(concept: LocalConcept, index: number): string {
  const definition = concept.definition.replace(/[.!?]+$/, '');
  const topic = concept.chapter;
  switch (index % 4) {
    case 1:
      return `Which term refers to ${lowerFirst(definition)}?`;
    case 2:
      return topic
        ? `In ${topic}, which concept is described as: ${definition}?`
        : `Which term is described as: ${definition}?`;
    case 3:
      return `This is ${lowerFirst(definition)}.`;
    default:
      return `${isPlural(concept.term) ? 'What are' : 'What is'} ${concept.term}?`;
  }
}

function buildOptions(concept: LocalConcept, distractors: LocalConcept[], answerIndex: number): {
  options: string[];
  correctAnswer: number;
  fallbackCount: number;
} {
  const options: string[] = [];
  const used = new Set<string>();
  const add = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || used.has(normalized)) return false;
    used.add(normalized);
    options.push(value.trim());
    return true;
  };

  const ordered = new Array<string>(4);
  const correctIndex = answerIndex % 4;
  ordered[correctIndex] = concept.term;
  let distractorIndex = 0;
  for (let index = 0; index < 4; index++) {
    if (index === correctIndex) continue;
    const distractor = distractors[distractorIndex++];
    ordered[index] = distractor?.term || SAFE_FALLBACK_DISTRACTORS[index < correctIndex ? index : index - 1];
  }

  for (const option of ordered) add(option);
  for (const fallback of SAFE_FALLBACK_DISTRACTORS) {
    if (options.length >= 4) break;
    add(fallback);
  }

  return {
    options: options.slice(0, 4),
    correctAnswer: options.findIndex((option) => option.toLowerCase() === concept.term.toLowerCase()),
    fallbackCount: options.filter((option) => SAFE_FALLBACK_DISTRACTORS.includes(option)).length
  };
}

export class LocalQuizGenerator {
  static extractConcepts(pages: HandoutPage[]): LocalConcept[] {
    const candidates: ConceptCandidate[] = [];
    let order = 0;

    for (const page of pages) {
      const namingPairs = extractNamingDefinitions(page.text);
      for (const pair of namingPairs) {
        addNamingCandidate(candidates, pair, page, order++);
      }

      const lines = page.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      let current: { term: string; parts: string[]; evidence: LocalConcept['evidence'] } | null = null;

      const flush = () => {
        if (!current) return;
        addCandidate(candidates, { term: current.term, definition: current.parts.join(' ') }, page, current.evidence, order++);
        current = null;
      };

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const delimited = splitDelimitedLine(line);
        const sentence = splitSentenceDefinition(line);

        if (delimited) {
          flush();
          current = { term: delimited.term, parts: [delimited.definition], evidence: 'delimiter' };
          continue;
        }

        if (NAMING_RELATION.test(line)) {
          flush();
          continue;
        }

        if (sentence) {
          flush();
          current = { term: sentence.term, parts: [sentence.definition], evidence: 'sentence' };
          continue;
        }

        const nextLine = lines[index + 1];
        if (looksLikeStandaloneTerm(line) && nextLine && isDefinitionLike(nextLine)) {
          flush();
          current = { term: stripBullet(line), parts: [cleanDefinition(nextLine)], evidence: 'wrapped' };
          index++;
          continue;
        }

        if (current && !looksLikeStandaloneTerm(line)) {
          current.parts.push(stripBullet(line));
        } else if (current) {
          flush();
        }
      }
      flush();
    }

    return candidates
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...candidate }) => candidate);
  }

  static generate(options: {
    handoutPages: HandoutPage[];
    targetCount?: number;
    subjectName?: string;
  }): RawAiQuestion[] {
    const baseConcepts = this.extractConcepts(options.handoutPages);
    if (baseConcepts.length === 0) return [this.buildNoConceptQuestion(options.handoutPages)];

    const compoundGroups = baseConcepts
      .map((concept) => extractCompoundGroup(concept))
      .filter((group): group is CompoundConceptGroup => Boolean(group));
    const groupByParent = new Map(
      compoundGroups.map((group) => [group.parent.term.toLowerCase(), group])
    );
    const concepts = baseConcepts.flatMap((concept) => {
      const group = groupByParent.get(concept.term.toLowerCase());
      return group ? [concept, ...group.children] : [concept];
    });

    const targetCount = Math.max(1, options.targetCount || 10);
    const questions: RawAiQuestion[] = [];
    const selected = concepts.slice(0, targetCount);

    for (let index = 0; index < selected.length; index++) {
      if (questions.length >= targetCount) break;

      const concept = {
        ...selected[index],
        chapter: selected[index].chapter || options.subjectName
      };
      const sameChapter = concepts.filter((candidate) => candidate.chapter === concept.chapter);
      const distractors = stableDistractorOrder(concept, sameChapter.length >= 3 ? sameChapter : concepts);
      const built = buildOptions(concept, distractors, index);
      if (built.options.length !== 4 || built.correctAnswer < 0) continue;

      const isCompound = Boolean(groupByParent.has(concept.term.toLowerCase()) || concept.parentTerm);
      questions.push({
        question: concept.namingRelation
          ? namingQuestionStem(concept)
          : isCompound
            ? compoundQuestionStem(concept)
            : questionStem(concept, index),
        options: built.options,
        correct_answer: built.correctAnswer,
        explanation: `According to the source material, ${concept.term} is ${lowerFirst(concept.definition)}.`,
        correct_explanation: concept.definition,
        source_pages: concept.sourcePages,
        chapter: concept.chapter,
        discriminatory_keywords: tokenize(concept.definition).slice(0, 5)
      });

      const group = groupByParent.get(concept.term.toLowerCase());
      if (group && questions.length < targetCount) {
        questions.push(buildEnumerationQuestion(group, concepts));
      }
    }

    return questions.length > 0 ? questions : [this.buildNoConceptQuestion(options.handoutPages)];
  }

  private static buildNoConceptQuestion(pages: HandoutPage[]): RawAiQuestion {
    const page = pages.find((candidate) => candidate.text.trim());
    const sourcePage = page?.pageNumber || 1;
    return {
      question: 'Which statement best describes the available source material?',
      options: [
        'The source does not contain an explicit term-definition pair',
        'The source contains only unrelated numerical data',
        'The source contains no readable material',
        'The source is an empty document'
      ],
      correct_answer: 0,
      explanation: 'No explicit term-definition pair was detected, so the local generator could not safely infer a specific concept.',
      source_pages: [sourcePage]
    };
  }
}

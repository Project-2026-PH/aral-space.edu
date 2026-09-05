import { HandoutPage, RawAiQuestion } from '@quiz-creator/types';

export interface LocalConcept {
  term: string;
  definition: string;
  sourcePages: number[];
  chapter?: string;
  confidence: number;
  evidence: 'delimiter' | 'sentence' | 'wrapped';
}

interface ConceptCandidate extends LocalConcept {
  order: number;
}

const TERM_SHAPE = /^[A-Z0-9][A-Za-z0-9\s\-_/()&'’]*$/;
const BULLET_PREFIX = /^(?:[•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[a-zA-Z][.)])\s+/;
const SENTENCE_VERB = /^(?:is|are|was|were|refers to|means|describes|defines|consists of|includes|allows|provides|represents|denotes)\s+/i;
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

function looksLikeStandaloneTerm(value: string): boolean {
  const term = stripBullet(value);
  return isValidTerm(term) && !/[,:;.!?]$/.test(term) && term.split(/\s+/).length <= 8;
}

function conceptKey(term: string, definition: string): string {
  return `${normalizeTerm(term).toLowerCase()}|${definition.toLowerCase()}`;
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
    const concepts = this.extractConcepts(options.handoutPages);
    if (concepts.length === 0) return [this.buildNoConceptQuestion(options.handoutPages)];

    const targetCount = Math.max(1, options.targetCount || 10);
    const questions: RawAiQuestion[] = [];
    const selected = concepts.slice(0, targetCount);

    for (let index = 0; index < selected.length; index++) {
      const concept = {
        ...selected[index],
        chapter: selected[index].chapter || options.subjectName
      };
      const sameChapter = concepts.filter((candidate) => candidate.chapter === concept.chapter);
      const distractors = stableDistractorOrder(concept, sameChapter.length >= 3 ? sameChapter : concepts);
      const built = buildOptions(concept, distractors, index);
      if (built.options.length !== 4 || built.correctAnswer < 0) continue;

      questions.push({
        question: questionStem(concept, index),
        options: built.options,
        correct_answer: built.correctAnswer,
        explanation: `According to the source material, ${concept.term} is ${lowerFirst(concept.definition)}.`,
        correct_explanation: concept.definition,
        source_pages: concept.sourcePages,
        chapter: concept.chapter,
        discriminatory_keywords: tokenize(concept.definition).slice(0, 5)
      });
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

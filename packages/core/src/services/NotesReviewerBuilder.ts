import type { QuizQuestionInput } from '@quiz-creator/types';

export interface NotesReviewerBuildOptions {
  text: string;
  maxQuestions?: number;
  includeReinforcement?: boolean;
}

export interface NotesReviewerConcept {
  term: string;
  definition: string;
  category?: string;
  aliases: string[];
  sourceOrder: number;
}

export interface NotesReviewerTimelineEntry {
  period: string;
  definition: string;
  sourceOrder: number;
}

export interface NotesReviewerAttribute {
  label: string;
  definition: string;
  group: 'service-desk' | 'helpdesk';
  sourceOrder: number;
}

export type NotesReviewerQuestion = QuizQuestionInput & { order_index: number };

interface DraftConcept extends NotesReviewerConcept {
  acronym?: string;
  sourceDefinition: string;
}

interface DraftTimelineEntry extends NotesReviewerTimelineEntry {
  sourceDefinition: string;
}

interface DraftAttribute extends NotesReviewerAttribute {
  sourceDefinition: string;
}

interface SectionContext {
  key?: string;
  comparisonGroup?: 'service-desk' | 'helpdesk';
}

const BULLET_PREFIX = /^(?:[•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[oO][.)]?(?=\s)|[a-zA-Z][.)])\s+/;
const TERM_SHAPE = /^[A-Z0-9][A-Za-z0-9\s.\-_/()&'’]*$/;
const DATE_HEADING = /^(?:(?:early|mid|late)[-\s])?\d{4}s?(?:\s*[–—-]\s*\d{4}s?)?\b/i;
const SENTENCE_START = /^(?:a|an|the|this|that|these|those|it|they|often|when|where|in that|in which|using|allows?|provides?|focuses?|refers?|means?|works?|supports?|designed|effective|accounted|contact|timely|additional|is|are|was|were)\b/i;
const TERM_SENTENCE_START = /^(?:this|that|these|those|they|often|when|where|in that|in which|using|allows?|provides?|focuses?|refers?|means?|works?|supports?|designed|effective|accounted|contact|timely|additional)\b/i;
const DEFINITION_VERB = /\b(?:is|are|was|were|refers to|means|describes|defines|consists of|includes|allows|provides|focuses on|ensures|results in|leads to|deals with|gives|lets|offers|designed for|affords|supports|helps)\b/i;
const HEADING_CUE = /^(?:benefits?|it(?:sm)?\s+history|history|timeline|it(?:sm)?\s+tools?(?:\s+and\s+software)?|it(?:sm)?\s+software|requirements?(?:\s+for)?|service\s+desk|help\s*desk|comparison|overview|introduction|characteristics?|features?|examples?|notes?)\b/i;
const ATTRIBUTE_LABEL = /(?:-centric|-oriented|-focused|-based|-driven)$/i;
const COMMON_ATTRIBUTE_LABEL = /^(?:business-centric|user-centric|proactive\s+service|reactive\s+service|complete\s+picture|break-fix\s+model|task-oriented)$/i;
const ACRONYM_ONLY = /^[A-Z][A-Z0-9-]{1,10}$/;
const STOP_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'their', 'this', 'to', 'with']);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripMarkupAndBullet(value: string): string {
  return value
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(BULLET_PREFIX, '')
    .replace(/^\*+|\*+$/g, '')
    .trim();
}

function cleanDefinition(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^[:\-–—]\s*/, '')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function normalizeTerm(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^\*+|\*+$/g, '')
    .replace(/^(?:a|an|the)\s+/i, '')
    .trim();
}

function isValidTerm(value: string): boolean {
  const term = normalizeTerm(value);
  if (!TERM_SHAPE.test(term) || term.length < 2 || term.length > 100) return false;
  if (term.split(/\s+/).length > 10) return false;
  if (/^(?:note|example|definition|introduction|overview|summary|references?)$/i.test(term)) return false;
  if (TERM_SENTENCE_START.test(term) || DEFINITION_VERB.test(term)) return false;
  if (/[,:;!?]/.test(term) || /\.$/.test(term)) return false;
  return !DATE_HEADING.test(term);
}

function isDefinitionLike(value: string): boolean {
  const definition = cleanDefinition(value);
  return definition.length > 12 && (SENTENCE_START.test(definition) || DEFINITION_VERB.test(definition) || /[,.;!?]/.test(definition));
}

function isSectionHeading(value: string): boolean {
  const line = stripMarkupAndBullet(value);
  if (!line) return false;
  if (DATE_HEADING.test(line)) return false;
  if (/[:：]\s*$/.test(line)) return true;
  if (HEADING_CUE.test(line) && !/[.!?]$/.test(line)) return true;
  return /^[A-Z][A-Z\s&/-]{4,}$/.test(line);
}

function getSectionContext(value: string): SectionContext {
  const line = stripMarkupAndBullet(value).replace(/[:：]\s*$/, '').trim();
  if (/^service\s+desk$/i.test(line)) return { key: 'service-desk', comparisonGroup: 'service-desk' };
  if (/^help\s*desk$/i.test(line)) return { key: 'helpdesk', comparisonGroup: 'helpdesk' };
  if (/benefit/i.test(line)) return { key: 'benefits' };
  if (/software|tools?/i.test(line)) return { key: 'software' };
  if (/requirement/i.test(line)) return { key: 'requirements' };
  if (/history|timeline/i.test(line)) return { key: 'timeline' };
  return {};
}

function isTimelineMarker(value: string): boolean {
  return DATE_HEADING.test(stripMarkupAndBullet(value));
}

function splitExplicitPair(value: string): { term: string; definition: string } | null {
  const body = stripMarkupAndBullet(value);
  const match = body.match(/^(.{2,100}?)(?:\s*:\s+|\s+[–—-]\s+)([\s\S]+)$/);
  if (!match || !isValidTerm(match[1])) return null;
  const definition = cleanDefinition(match[2]);
  return definition.length > 8 ? { term: normalizeTerm(match[1]), definition } : null;
}

function looksLikeStandaloneTerm(value: string): boolean {
  const term = stripMarkupAndBullet(value);
  return isValidTerm(term) && !/[,:;.!?]$/.test(term) && term.split(/\s+/).length <= 8;
}

function isAttributeLabel(value: string, context: SectionContext): boolean {
  const label = normalizeTerm(stripMarkupAndBullet(value));
  if (!label || !looksLikeStandaloneTerm(label)) return false;
  return Boolean(context.comparisonGroup) || ATTRIBUTE_LABEL.test(label) || COMMON_ATTRIBUTE_LABEL.test(label);
}

function extractAcronym(term: string): string | undefined {
  const parenthetical = term.match(/\(([A-Z][A-Z0-9-]{1,10})\)/);
  if (parenthetical) return parenthetical[1].toUpperCase();
  if (ACRONYM_ONLY.test(term)) return term.toUpperCase();
  return undefined;
}

function generatedAcronym(term: string): string | undefined {
  const base = term.replace(/\([^)]*\)/g, '').trim();
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length < 2) return undefined;
  const acronym = words
    .map((word) => (/^[A-Z]{2,}[0-9-]*$/.test(word) ? word : word[0]))
    .join('')
    .toUpperCase();
  return acronym.length >= 2 ? acronym : undefined;
}

function termKey(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function termsAreEquivalent(left: DraftConcept, right: DraftConcept): boolean {
  const leftKey = termKey(left.term);
  const rightKey = termKey(right.term);
  if (leftKey === rightKey) return true;

  const leftAcronyms = new Set([left.acronym, generatedAcronym(left.term)].filter(Boolean).map((value) => value!.toLowerCase()));
  const rightAcronyms = new Set([right.acronym, generatedAcronym(right.term)].filter(Boolean).map((value) => value!.toLowerCase()));
  return (leftAcronyms.has(rightKey) || rightAcronyms.has(leftKey)) && (leftAcronyms.size > 0 || rightAcronyms.size > 0);
}

function preferredTerm(left: DraftConcept, right: DraftConcept): string {
  const leftIsAcronym = ACRONYM_ONLY.test(left.term);
  const rightIsAcronym = ACRONYM_ONLY.test(right.term);
  if (leftIsAcronym && !rightIsAcronym) return right.term;
  if (rightIsAcronym && !leftIsAcronym) return left.term;
  return left.term.length >= right.term.length ? left.term : right.term;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((token) => !STOP_WORDS.has(token)) || [];
}

function redactedDefinition(definition: string, term: string): string {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return definition.replace(new RegExp(`(^|[^A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'gi'), '$1this concept');
}

function conceptTag(term: string): string {
  return `concept:${termKey(term)}`;
}

function addConcept(concepts: DraftConcept[], pair: { term: string; definition: string; category?: string }, sourceOrder: number): void {
  const term = normalizeTerm(pair.term);
  const definition = cleanDefinition(pair.definition);
  if (!isValidTerm(term) || definition.length <= 8) return;

  const candidate: DraftConcept = {
    term,
    definition,
    sourceDefinition: definition,
    category: pair.category,
    aliases: [],
    acronym: extractAcronym(term) || generatedAcronym(term),
    sourceOrder
  };
  const existing = concepts.find((concept) => termsAreEquivalent(concept, candidate));
  if (!existing) {
    concepts.push(candidate);
    return;
  }

  existing.term = preferredTerm(existing, candidate);
  existing.acronym = existing.acronym || candidate.acronym;
  existing.aliases = Array.from(new Set([...existing.aliases, existing.term, candidate.term])).filter((alias) => alias !== existing.term);
  if (candidate.definition.length > existing.definition.length) {
    existing.definition = candidate.definition;
    existing.sourceDefinition = candidate.sourceDefinition;
  }
  existing.category = existing.category || candidate.category;
}

function mergeTimeline(entries: DraftTimelineEntry[], entry: DraftTimelineEntry): void {
  const existing = entries.find((candidate) => candidate.period.toLowerCase() === entry.period.toLowerCase());
  if (!existing) {
    entries.push(entry);
  } else if (entry.definition.length > existing.definition.length) {
    existing.definition = entry.definition;
    existing.sourceDefinition = entry.sourceDefinition;
  }
}

const INLINE_DASH_PAIR_START = /(?<![A-Za-z0-9(])\b([A-Z][A-Za-z0-9./()&'’]*(?:[ \t]+[A-Za-z0-9(][A-Za-z0-9./()&'’]*){0,9})[ \t]+([–—-])[ \t]+/g;
const INLINE_COLON_PAIR_START = /(?<![A-Za-z0-9(])\b([A-Z][A-Za-z0-9./()&'’]*(?:[ \t]+[A-Za-z0-9(][A-Za-z0-9./()&'’]*){0,9})[ \t]*:[ \t]*(?=[A-Z])/g;
const INLINE_TIMELINE_START = /\b((?:(?:early|mid|late)[-\s])?\d{4}s?(?:[ \t]*[–—-][ \t]*\d{4}s?)?)[ \t]*:[ \t]*/gi;
const INLINE_HEADING = /\b(Benefits of ITSM|ITSM History|ITSM Tools and Software|Requirements for Choosing ITSM Tools|Service Desk(?!s)(?![ \t]+[–—-][ \t]+)|Helpdesk(?!s)(?![ \t]+[–—-][ \t]+)|ITSM Software)(?:[ \t]*:[ \t]*)?/gi;
const INLINE_ATTRIBUTE_LABEL = /\b(Business-centric|User-centric|Proactive Service|Reactive Service|Complete Picture|Process Oriented|Break-Fix Model|Task-Oriented)(?=[A-Z])/g;

function insertInlineBoundaries(value: string): string {
  let normalized = value.replace(/\r\n?/g, '\n');
  normalized = normalized.replace(INLINE_HEADING, '\n$1\n');
  normalized = normalized.replace(INLINE_TIMELINE_START, '\n$1: ');
  normalized = normalized.replace(INLINE_DASH_PAIR_START, '\n$1 $2 ');
  normalized = normalized.replace(INLINE_COLON_PAIR_START, '\n$1: ');
  normalized = normalized.replace(INLINE_ATTRIBUTE_LABEL, '\n$1\n');
  return normalized;
}

function collectLines(text: string): string[] {
  return insertInlineBoundaries(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export class NotesReviewerBuilder {
  static extractConcepts(text: string): NotesReviewerConcept[] {
    return this.extractDraft(text).concepts.map(({ acronym: _acronym, sourceDefinition: _sourceDefinition, ...concept }) => concept);
  }

  static extractTimelineEntries(text: string): NotesReviewerTimelineEntry[] {
    return this.extractDraft(text).timeline.map(({ sourceDefinition: _sourceDefinition, ...entry }) => entry);
  }

  static build(options: NotesReviewerBuildOptions): NotesReviewerQuestion[] {
    const { concepts, timeline, attributes } = this.extractDraft(options.text);
    const includeReinforcement = options.includeReinforcement !== false;
    const questions: NotesReviewerQuestion[] = [];
    const maxQuestions = Math.max(1, Math.min(100, options.maxQuestions ?? 100));

    for (const concept of concepts) {
      if (questions.length >= maxQuestions) break;
      questions.push(this.buildIdentificationQuestion(concept, questions.length));

      if (includeReinforcement && questions.length < maxQuestions) {
        const reinforcement = this.buildReinforcementQuestion(concept, concepts, questions.length);
        if (reinforcement) questions.push(reinforcement);
      }
    }

    for (const comparison of this.buildComparisonQuestions(attributes, questions.length)) {
      if (questions.length >= maxQuestions) break;
      questions.push(comparison);
    }

    // Timeline cards are intentionally appended after terminology/comparison cards.
    for (const entry of timeline) {
      if (questions.length >= maxQuestions) break;
      questions.push({
        question_text: `What happened during ${entry.period}?`,
        answer_text: entry.definition,
        question_type: 'typed_answer',
        options: [entry.definition],
        correct_answer: 0,
        explanation: entry.sourceDefinition,
        correct_explanation: entry.sourceDefinition,
        concept_tags: ['timeline'],
        source_pages: null,
        order_index: questions.length
      });
    }

    return questions;
  }

  private static extractDraft(text: string): {
    concepts: DraftConcept[];
    timeline: DraftTimelineEntry[];
    attributes: DraftAttribute[];
  } {
    const concepts: DraftConcept[] = [];
    const timeline: DraftTimelineEntry[] = [];
    const attributes: DraftAttribute[] = [];
    const lines = collectLines(text);
    let context: SectionContext = {};
    let currentConcept: { term: string; parts: string[]; category?: string; sourceOrder: number } | null = null;
    let currentTimeline: { period: string; parts: string[]; sourceOrder: number } | null = null;
    let order = 0;

    const flushConcept = () => {
      if (!currentConcept) return;
      addConcept(concepts, {
        term: currentConcept.term,
        definition: currentConcept.parts.join(' '),
        category: currentConcept.category
      }, currentConcept.sourceOrder);
      currentConcept = null;
    };

    const flushTimeline = () => {
      if (!currentTimeline) return;
      const definition = cleanDefinition(currentTimeline.parts.join(' '));
      if (definition.length > 8) {
        mergeTimeline(timeline, {
          period: currentTimeline.period,
          definition,
          sourceDefinition: definition,
          sourceOrder: currentTimeline.sourceOrder
        });
      }
      currentTimeline = null;
    };

    for (let index = 0; index < lines.length; index++) {
      const rawLine = lines[index];
      const line = stripMarkupAndBullet(rawLine);
      const nextLine = lines[index + 1] ? stripMarkupAndBullet(lines[index + 1]) : '';
      const explicit = splitExplicitPair(rawLine);

      if (isTimelineMarker(line)) {
        flushConcept();
        flushTimeline();
        const markerMatch = line.match(/^((?:(?:early|mid|late)[-\s])?\d{4}s?(?:\s*[–—-]\s*\d{4}s?)?)(?:\s*:\s*(.*))?$/i);
        if (markerMatch) {
          currentTimeline = {
            period: markerMatch[1].trim(),
            parts: markerMatch[2] ? [markerMatch[2].trim()] : [],
            sourceOrder: order++
          };
          context = { key: 'timeline' };
          continue;
        }
      }

      if (isSectionHeading(line) && !explicit) {
        flushConcept();
        flushTimeline();
        context = getSectionContext(line);
        continue;
      }

      if (currentTimeline) {
        if (explicit || looksLikeStandaloneTerm(line) || isSectionHeading(line)) {
          flushTimeline();
          // Re-process this line as a normal concept/heading on the next branch.
          if (isSectionHeading(line) && !explicit) {
            context = getSectionContext(line);
            continue;
          }
        } else {
          currentTimeline.parts.push(line);
          continue;
        }
      }

      if (explicit) {
        flushConcept();
        currentConcept = {
          term: explicit.term,
          parts: [explicit.definition],
          category: context.key === 'timeline' ? undefined : context.key,
          sourceOrder: order++
        };
        continue;
      }

      if (isAttributeLabel(line, context) && nextLine && isDefinitionLike(nextLine)) {
        flushConcept();
        if (context.comparisonGroup) {
          attributes.push({
            label: normalizeTerm(line),
            definition: cleanDefinition(nextLine),
            sourceDefinition: cleanDefinition(nextLine),
            group: context.comparisonGroup,
            sourceOrder: order++
          });
        }
        index++;
        continue;
      }

      if (looksLikeStandaloneTerm(line) && nextLine && isDefinitionLike(nextLine) && !isSectionHeading(line)) {
        flushConcept();
        currentConcept = {
          term: normalizeTerm(line),
          parts: [cleanDefinition(nextLine)],
          category: context.key === 'timeline' ? undefined : context.key,
          sourceOrder: order++
        };
        index++;
        continue;
      }

      if (currentConcept) {
        currentConcept.parts.push(line);
      }
    }

    flushConcept();
    flushTimeline();

    concepts.sort((left, right) => left.sourceOrder - right.sourceOrder);
    timeline.sort((left, right) => left.sourceOrder - right.sourceOrder);
    attributes.sort((left, right) => left.sourceOrder - right.sourceOrder);
    return { concepts, timeline, attributes };
  }

  private static buildIdentificationQuestion(concept: DraftConcept, orderIndex: number): NotesReviewerQuestion {
    const tags = ['terminology', conceptTag(concept.term)];
    if (concept.category) tags.push(concept.category);
    return {
      question_text: `Recall: ${concept.sourceDefinition}`,
      answer_text: concept.term,
      question_type: 'typed_answer',
      options: [concept.term],
      correct_answer: 0,
      explanation: concept.sourceDefinition,
      correct_explanation: concept.sourceDefinition,
      concept_tags: tags,
      source_pages: null,
      order_index: orderIndex
    };
  }

  private static buildReinforcementQuestion(
    concept: DraftConcept,
    concepts: DraftConcept[],
    orderIndex: number
  ): NotesReviewerQuestion | null {
    const distractors = concepts.filter((candidate) => candidate !== concept && !candidate.aliases.includes(concept.term));
    if (distractors.length < 3) return null;

    const correctIndex = orderIndex % 4;
    const selected = distractors.slice(0, 3).map((candidate) => candidate.term);
    const options = [...selected];
    options.splice(correctIndex, 0, concept.term);

    return {
      question_text: `What does “${concept.term}” mean?`,
      answer_text: concept.term,
      question_type: 'multiple_choice',
      options,
      correct_answer: correctIndex,
      explanation: concept.sourceDefinition,
      correct_explanation: concept.sourceDefinition,
      discriminatory_keywords: tokenize(concept.sourceDefinition).slice(0, 5),
      concept_tags: ['reinforcement', 'terminology', conceptTag(concept.term)],
      source_pages: null,
      order_index: orderIndex
    };
  }

  private static buildComparisonQuestions(attributes: DraftAttribute[], startOrder: number): NotesReviewerQuestion[] {
    const serviceDesk = attributes.filter((attribute) => attribute.group === 'service-desk');
    const helpdesk = attributes.filter((attribute) => attribute.group === 'helpdesk');
    if (serviceDesk.length === 0 || helpdesk.length === 0) return [];

    const questions: NotesReviewerQuestion[] = [];
    const build = (targetGroup: 'service-desk' | 'helpdesk', source: DraftAttribute[], other: DraftAttribute[], orderIndex: number) => {
      if (source.length === 0 || other.length < 3) return;
      const correct = source[0];
      const distractorLabels = other.slice(0, 3).map((attribute) => attribute.label);
      const correctIndex = orderIndex % 4;
      const options = [...distractorLabels];
      options.splice(correctIndex, 0, correct.label);
      const targetName = targetGroup === 'service-desk' ? 'Service Desk' : 'Helpdesk';
      const otherName = targetGroup === 'service-desk' ? 'Helpdesk' : 'Service Desk';
      questions.push({
        question_text: `Which characteristic is associated with a ${targetName} rather than a ${otherName}?`,
        answer_text: correct.label,
        question_type: 'multiple_choice',
        options,
        correct_answer: correctIndex,
        explanation: `${targetName}: ${correct.sourceDefinition} ${otherName} attributes in the source include ${other.map((attribute) => `${attribute.label} (${attribute.sourceDefinition})`).join('; ')}.`,
        correct_explanation: correct.sourceDefinition,
        concept_tags: ['comparison', targetGroup],
        source_pages: null,
        order_index: orderIndex
      });
    };

    build('service-desk', serviceDesk, helpdesk, startOrder);
    build('helpdesk', helpdesk, serviceDesk, startOrder + questions.length);
    return questions;
  }
}

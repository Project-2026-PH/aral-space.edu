export type ParsedClipboard =
  | { type: 'single_pair'; term: string; definition: string }
  | { type: 'bulk_terms'; items: Array<{ term: string; definition: string }> }
  | { type: 'question_answer'; question: string; answer: string }
  | { type: 'question_answers'; items: Array<{ question: string; answer: string }> }
  | { type: 'enumeration_blocks'; blocks: Array<{ header: string; items: string[] }> };

/** Bullet/enumeration markers that may prefix a term line. */
const BULLET_PREFIX = /^(?:[•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[oO][.)]?(?=\s)|[a-zA-Z][.)])\s+/;

/** Splits a line into `term <delimiter> rest`, taking the earliest delimiter. */
const TERM_DELIMITER = /^(.{2,80}?)(?:\s*:(?:\s+|$)|\s+[–—](?:\s+|$)|\s+-(?:\s+|$))([\s\S]*)$/;

/** A term looks like a short label, not a sentence: no commas or sentence punctuation. */
const TERM_SHAPE = /^[A-Z0-9][A-Za-z0-9\s.\-_/()&'’]*$/;

/** Finite verbs — their presence means a clause is a statement, not a term label. */
const FINITE_VERB =
  /\b(?:is|are|was|were|be|been|being|am|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must|refers|means|includes|consists|focuses|allows|provides|describes|involves|deals)\b/i;

/** Term side of an appositive clause: a short noun phrase, e.g. "the marketspace". */
function isAppositiveTerm(clause: string): boolean {
  if (clause.length > 40) return false;
  if (clause.split(/\s+/).length > 4) return false;
  if (/[.!?:]/.test(clause)) return false;
  return !FINITE_VERB.test(clause);
}

/** Definition side: a descriptive phrase of real substance, longer than its term. */
function isAppositiveDefinition(clause: string, term: string): boolean {
  if (clause.length <= 5 || clause.length <= term.length) return false;
  return clause.split(/\s+/).length >= 3;
}

/**
 * A standalone line that reads like a label (a term) rather than a clause of prose.
 * Used to decide whether a 2-line paste is `Term \n Definition` or just wrapped prose.
 */
function isLabelLike(value: string): boolean {
  const line = value.trim();
  if (!line) return false;
  if (/[,;:]/.test(line)) return false;
  if (/[.!?]/.test(line)) return false;
  if (FINITE_VERB.test(line)) return false;
  if (/^(?:as|because|although|while|when|where|if|since|unless|after|before|and|but|or)\b/i.test(line)) {
    return false;
  }
  if (/\b(?:and|or|but|as|of|for|with|to|from|by|in|on|at|into|onto|through|via|than|without|within|between|among|during|over|under|the|that|which)\s*$/i.test(line)) {
    return false;
  }
  return line.length <= 80 && line.split(/\s+/).length <= 10;
}

/**
 * A long or sentence-like line after a label-shaped heading is likely the
 * heading's wrapped definition rather than the right side of a delimiter.
 */
function isDefinitionLikeLine(value: string): boolean {
  const line = value.trim();
  return line.length >= 40 || /[,.;!?]/.test(line) || /^(?:a|an|the|this|that|these|those|often|when|where|developers?|it|they)\b/i.test(line);
}

const HEADING_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with'
]);

const SECTION_HEADING_PATTERN =
  /^(?:overview|introduction|background|summary|history|features?|requirements?|benefits?|limitations?|advantages?|disadvantages?|pricing|services?|key\s+points?|objectives?|steps?|examples?|causes?|effects?)\b/i;

function isTitleCaseHeading(line: string): boolean {
  const words = line.split(/\s+/).filter((word) => /[A-Za-z]/.test(word));
  if (words.length === 0) return false;

  const hasCapitalizedWord = words.some((word) => /^[A-Z][A-Za-z0-9'’/&()\-/]*$/.test(word));
  return (
    hasCapitalizedWord &&
    words.every(
      (word) =>
        HEADING_STOP_WORDS.has(word.toLowerCase()) || /^[A-Z][A-Za-z0-9'’/&()\-/]*$/.test(word)
    )
  );
}

/**
 * Recognizes a structural heading without treating an arbitrary short prose
 * fragment as a term. Title Case/all-caps, known section cues, or a terminal
 * colon provide the heading evidence; finite verbs and sentence punctuation
 * disqualify the line.
 */
function isHeadingShape(value: string): boolean {
  const rawLine = value.trim();
  const line = rawLine.replace(/:\s*$/, '').trim();
  if (!line || line.length > 80 || line.split(/\s+/).length > 10) return false;
  if (/[,;.!?]/.test(line) || FINITE_VERB.test(line)) return false;

  const allCaps = /[A-Z]/.test(line) && line === line.toUpperCase();
  const sectionCue = SECTION_HEADING_PATTERN.test(line);
  const titleCase = isTitleCaseHeading(line);
  const colonEvidence = /:\s*$/.test(rawLine);

  return allCaps || titleCase || sectionCue || colonEvidence;
}

/**
 * Joins only PDF-style soft wraps. Sentence boundaries, bullets, and
 * heading-shaped lines remain boundaries so explicit structures and sections
 * are not flattened together.
 */
function shouldJoinPdfSoftWrap(previous: string, next: string): boolean {
  if (!previous || !next || BULLET_PREFIX.test(next)) return false;
  if (isHeadingShape(previous)) return false;
  if (/[.!?]["'”’)]*\s*$/.test(previous)) return false;
  if (/-\s*$/.test(previous) && /^[a-z]/.test(next)) return true;
  if (/^[a-z]/.test(next)) return true;

  return /(?:[,;:]|\b(?:and|or|but|as|to|of|for|with|from|by|in|on|at|into|onto|through|via|than|without|within|between|among|during|over|under)\s*)$/i.test(
    previous
  );
}

function joinPdfSoftWrap(previous: string, next: string): string {
  if (/-\s*$/.test(previous) && /^[a-z]/.test(next)) {
    return `${previous.replace(/-\s*$/, '')}${next}`;
  }
  return `${previous} ${next}`.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a plain-text clipboard working copy while preserving structural
 * line boundaries. Raw clipboard text is never mutated; callers can retain it
 * for cancellation or other fallbacks.
 */
function normalizePdfSoftWraps(text: string): string {
  const sourceLines = text.split(/\r?\n/);
  const normalizedLines: string[] = [];
  let lastContentIndex = -1;
  let blankSinceLastContent = false;

  for (const sourceLine of sourceLines) {
    const line = sourceLine.trim();
    if (!line) {
      if (lastContentIndex >= 0) blankSinceLastContent = true;
      continue;
    }

    if (lastContentIndex >= 0 && shouldJoinPdfSoftWrap(normalizedLines[lastContentIndex], line)) {
      normalizedLines[lastContentIndex] = joinPdfSoftWrap(normalizedLines[lastContentIndex], line);
    } else {
      if (blankSinceLastContent && normalizedLines[normalizedLines.length - 1] !== '') {
        normalizedLines.push('');
      }
      normalizedLines.push(line);
      lastContentIndex = normalizedLines.length - 1;
    }
    blankSinceLastContent = false;
  }

  return normalizedLines.join('\n').trim();
}

/**
 * Extracts standalone heading + paragraph blocks from handout-style text.
 * Explicit delimiters and list formats are intentionally handled earlier.
 */
function extractHeadingBlocks(text: string): Array<{ term: string; definition: string }> {
  const normalized = normalizePdfSoftWraps(text);
  const lines = normalized.split(/\r?\n/);
  const headingIndexes: number[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    const followingLine = nextNonEmptyLine(lines, index);
    if (followingLine && isHeadingShape(line) && isDefinitionLikeLine(followingLine)) {
      headingIndexes.push(index);
    }
  }

  const blocks: Array<{ term: string; definition: string }> = [];
  for (let headingIndex = 0; headingIndex < headingIndexes.length; headingIndex++) {
    const start = headingIndexes[headingIndex];
    const end = headingIndexes[headingIndex + 1] ?? lines.length;
    const term = lines[start].trim().replace(/:\s*$/, '').trim();
    const definition = lines
      .slice(start + 1, end)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (
      term &&
      definition.length >= 15 &&
      definition.split(/\s+/).length >= 3 &&
      isDefinitionLikeLine(definition)
    ) {
      blocks.push({ term, definition });
    }
  }

  return blocks;
}

/**
 * Distinguishes a standalone heading such as `M10 — Extraneous Functionality`
 * from an inline pair such as `DNS — Domain Name System`.
 */
function splitStandaloneHeading(body: string, followingLine?: string): string | null {
  if (!followingLine) return null;
  const match = body.match(/^(.{2,80}?)\s+[–—]\s+(.{2,80})$/);
  if (!match) return null;

  const prefix = match[1].trim();
  const title = match[2].trim();
  if (!looksLikeTerm(prefix) || !/^[A-Z0-9]/.test(title) || !isLabelLike(title) || !isDefinitionLikeLine(followingLine)) {
    return null;
  }

  return `${prefix} — ${title}`;
}

function nextNonEmptyLine(lines: string[], index: number): string | undefined {
  for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex++) {
    const line = lines[nextIndex].trim();
    if (line) return line;
  }
  return undefined;
}

function isQuestionLike(value: string): boolean {
  return (
    /\?$/.test(value) ||
    /^(?:what|who|where|when|why|how|which|define|explain|describe|identify|name|list|state|give)\b/i.test(value)
  );
}

function looksLikeTerm(candidate: string): boolean {
  if (!TERM_SHAPE.test(candidate)) return false;
  const words = candidate.split(/\s+/);
  return words.length <= 10;
}

const NUMBERED_LINE = /^\s*\(?\d+[.)]\s*(.+)$/;

/**
 * Extracts numbered question/answer blocks such as:
 * `1. What is an AP?` followed by `Answer: Access Point`.
 */
function extractNumberedQuestionAnswers(text: string): Array<{ question: string; answer: string }> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pairs: Array<{ question: string; answer: string }> = [];
  let question: string | null = null;
  let answerParts: string[] = [];

  const flush = () => {
    if (!question || answerParts.length === 0) return;
    const answer = answerParts.join(' ').replace(/\s+/g, ' ').trim();
    if (answer) pairs.push({ question, answer });
    question = null;
    answerParts = [];
  };

  for (const line of lines) {
    const numbered = line.match(NUMBERED_LINE);
    if (numbered) {
      flush();
      const candidate = numbered[1]
        .replace(/^(?:question|q)\s*[:.)-]\s*/i, '')
        .trim();
      question = isQuestionLike(candidate) ? candidate : null;
      continue;
    }

    if (question) {
      answerParts.push(line.replace(/^(?:answer|ans|a)\s*[:.)-]\s*/i, '').trim());
    }
  }

  flush();
  return pairs;
}

/**
 * Extracts numbered term/definition blocks such as:
 * `1. Rogue AP Attack` followed by its definition on the next line.
 * Numbered lists with no continuation remain enumeration lists.
 */
function extractNumberedTermDefinitions(text: string): Array<{ term: string; definition: string }> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pairs: Array<{ term: string; definition: string }> = [];
  let current: { term: string; parts: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const definition = current.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (definition) pairs.push({ term: current.term, definition });
    current = null;
  };

  for (const line of lines) {
    const numbered = line.match(NUMBERED_LINE);
    if (numbered) {
      flush();
      current = { term: numbered[1].trim(), parts: [] };
    } else if (current) {
      current.parts.push(line);
    }
  }

  flush();
  return pairs;
}


/**
 * Bulleted item with no delimiter at all, e.g.
 * "• Business Relationship Management focuses on identifying customers..."
 * Splits the leading Title Case run (3+ words) off as the term.
 * Only used for mixed lists where sibling bullets did use a delimiter.
 */
function splitTitleCaseTerm(body: string): { term: string; rest: string } | null {
  const match = body.match(/^((?:[A-Z][A-Za-z0-9&'’\-/]*\s+){2,}[A-Z][A-Za-z0-9&'’\-/]*)\s+([a-z][\s\S]*)$/);
  if (!match) return null;
  return { term: match[1].trim(), rest: match[2].trim() };
}

const DEFINITION_VERB_REGEX =
  /^([A-Za-z0-9][A-Za-z0-9\s.\-_/()&'’]{1,50}?)\s+\b(is\s+defined\s+as|refers\s+to|is\s+the\s+process\s+of|is\s+the\s+study\s+of|is\s+the\s+practice\s+of|is\s+the\s+science\s+of|is\s+used\s+to|describes|deals\s+with|focuses\s+on|means|consists\s+of|involves|is\s+(?:a|an|the))\b\s+([\s\S]+)$/i;

/**
 * Splits delimiter-free sentences where a connecting verb links the term to its definition.
 * Common in textbook paragraphs and PDF copies where all bolding and delimiters are stripped.
 * e.g., "computer graphics describes the use of computers to create and manipulate images"
 */
export function splitDefinitionVerb(body: string): { term: string; definition: string } | null {
  const match = body.match(DEFINITION_VERB_REGEX);
  if (!match) return null;

  const rawTerm = match[1].trim();
  const verb = match[2].trim();
  const rest = match[3].trim();

  const cleanTerm = rawTerm.replace(/^(?:the|a|an)\s+/i, '').trim();

  // Guard 1: Term shape & length (at least 2 chars, max 50 chars, max 5 words, no punctuation)
  if (!cleanTerm || cleanTerm.length < 2 || cleanTerm.length > 50) return null;
  const termWords = cleanTerm.split(/\s+/);
  if (termWords.length > 5) return null;
  if (/[.!?:]/.test(cleanTerm)) return null;

  // Guard 2: Disallowed leading pronouns / question words
  if (/^(?:it|this|that|these|those|there|what|which|who|when|where|why|how)\b/i.test(cleanTerm)) {
    return null;
  }

  // Guard 3: No finite verbs inside the term candidate itself
  if (FINITE_VERB.test(cleanTerm)) return null;

  // Guard 4: Substantive definition remainder (at least 15 chars, at least 3 words)
  if (rest.length < 15 || rest.split(/\s+/).length < 3) return null;

  const combined = `${verb} ${rest}`.replace(/\s+/g, ' ').trim();
  const formattedDefinition = combined.charAt(0).toUpperCase() + combined.slice(1);

  return {
    term: cleanTerm,
    definition: formattedDefinition
  };
}

/**
 * Extracts one or more definition-verb records without mistaking a sentence
 * inside a definition for another card. Sentence boundaries are preferred for
 * pasted records on one line; line-start anchors handle wrapped records that
 * do not end with punctuation before the next term.
 */
function extractDefinitionVerbPairs(text: string): Array<{ term: string; definition: string }> {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentenceSegments = normalized.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  if (sentenceSegments.length >= 2) {
    const sentencePairs = sentenceSegments.map((segment) => splitDefinitionVerb(segment));
    if (sentencePairs.every((pair): pair is { term: string; definition: string } => Boolean(pair))) {
      return sentencePairs;
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const definitionStartIndexes = lines.reduce<number[]>((indexes, line, index) => {
    if (splitDefinitionVerb(line)) indexes.push(index);
    return indexes;
  }, []);

  if (definitionStartIndexes.length >= 2) {
    const linePairs = definitionStartIndexes.map((startIndex, pairIndex) => {
      const endIndex = definitionStartIndexes[pairIndex + 1] ?? lines.length;
      return splitDefinitionVerb(lines.slice(startIndex, endIndex).join(' '));
    });
    if (linePairs.every((pair): pair is { term: string; definition: string } => Boolean(pair))) {
      return linePairs;
    }
  }

  const singlePair = splitDefinitionVerb(normalized);
  return singlePair ? [singlePair] : [];
}

const PASSIVE_DEFINITION_REGEX =
  /^([\s\S]+?)\s+\b(?:is\s+|are\s+)?(?:called|known\s+as|referred\s+to\s+as|termed|designated\s+as|named)\s+(?:the\s+|a\s+|an\s+)?([A-Za-z0-9][A-Za-z0-9\s.\-_/()&'’]{1,50}?)[.]?$/i;

/**
 * Splits passive definition sentences where the term appears at the end following a naming verb.
 * e.g., "Pixel data is stored in a region of memory called the framebuffer."
 */
export function splitPassiveDefinition(body: string): { term: string; definition: string } | null {
  const match = body.trim().match(PASSIVE_DEFINITION_REGEX);
  if (!match) return null;

  const rawPrefix = match[1].replace(/\*\*/g, '').trim();
  const rawTerm = match[2].replace(/\*\*/g, '').trim();

  const cleanTerm = rawTerm.replace(/^(?:the|a|an)\s+/i, '').replace(/[.!?:]+$/, '').trim();
  if (!cleanTerm || cleanTerm.length < 2 || cleanTerm.length > 50) return null;
  const termWords = cleanTerm.split(/\s+/);
  if (termWords.length > 5) return null;
  if (/[.!?:]/.test(cleanTerm)) return null;

  if (/^(?:it|this|that|these|those|there|what|which|who|when|where|why|how)\b/i.test(cleanTerm)) {
    return null;
  }
  if (FINITE_VERB.test(cleanTerm)) return null;

  if (rawPrefix.length < 15 || rawPrefix.split(/\s+/).length < 3) return null;

  let formattedDefinition = rawPrefix.replace(/\s+/g, ' ').trim();
  formattedDefinition = formattedDefinition.charAt(0).toUpperCase() + formattedDefinition.slice(1);

  return {
    term: cleanTerm,
    definition: formattedDefinition
  };
}

/**
 * Line-oriented scan for `[bullet] Term: Definition` blocks.
 *
 * A definition spans every following line until the next term line is reached,
 * so PDF/slide text that wraps across several lines stays intact.
 */
function extractBulkTerms(
  text: string,
  allowTitleCaseFallback = false
): Array<{ term: string; definition: string }> {
  // PDF copies frequently collapse several bullets onto one line — break them apart first.
  const normalized = text.replace(/([^\n\s])[ \t]*([•▪‣◦●○])[ \t]*/g, '$1\n$2 ');
  const lines = normalized.split(/\r?\n/);

  const items: Array<{ term: string; definition: string }> = [];
  let current: { term: string; parts: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const definition = current.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (definition.length > 5) {
      items.push({ term: current.term, definition });
    }
    current = null;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trim();
    if (!line) continue;

    const isBulleted = BULLET_PREFIX.test(line);
    const body = line.replace(BULLET_PREFIX, '').replace(/^\*\*|\*\*$/g, '').trim();
    const headingTerm = splitStandaloneHeading(body, nextNonEmptyLine(lines, lineIndex));
    if (headingTerm) {
      flush();
      current = { term: headingTerm, parts: [] };
      continue;
    }

    const delimited = body.match(TERM_DELIMITER);
    const candidate = delimited?.[1]?.replace(/\*\*/g, '').trim();

    if (candidate && looksLikeTerm(candidate)) {
      flush();
      current = { term: candidate, parts: [] };
      const rest = delimited?.[2]?.trim();
      if (rest) current.parts.push(rest);
      continue;
    }

    if (allowTitleCaseFallback && isBulleted) {
      const titleCase = splitTitleCaseTerm(body);
      if (titleCase) {
        flush();
        current = { term: titleCase.term, parts: [titleCase.rest] };
        continue;
      }
    }

    if (isBulleted) {
      const verbSplit = splitDefinitionVerb(body) || splitPassiveDefinition(body);
      if (verbSplit) {
        flush();
        current = { term: verbSplit.term, parts: [verbSplit.definition] };
        continue;
      }
    }

    // Continuation line of the definition currently being built.
    if (current) current.parts.push(body);
  }
  flush();

  return items;
}

const META_BOLD_LABEL =
  /^(?:note|warning|tip|important|caution|notice|example|remember|remark|key|info|step\s*\d+|figure\s*\d+|table\s*\d+|chapter\s*\d+|section\s*\d+):?$/i;

const BOLD_LEAD_PATTERN =
  /^(?:(?:[•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[a-zA-Z][.)])\s+)?\*\*([^*]+)\*\*(.*)$/;

function isDisallowedTermWord(term: string): boolean {
  return /^(?:and|or|the|a|an|is|are|was|were|that|which|not|never|always|only|must|should|can|could|would|will)$/i.test(
    term
  );
}

/**
 * Normalizes rich clipboard HTML into text with markdown `**` bold markers.
 * Glues fragmented adjacent bold spans (Word/Docs) and converts lists/paragraphs into newlines.
 */
export function normalizeHtmlClipboard(html: string): string {
  if (!html || !html.trim()) return '';

  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, ' **$1** ')
      .replace(
        /<span\b[^>]*style="[^"]*font-weight:\s*(?:bold|bolder|[6-9]00)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
        ' **$1** '
      )
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<(?:p|div|tr|h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/[ \t]+/g, ' ')
      .replace(/\*\*\s*\*\*/g, '')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.body.normalize();

    const isBoldElement = (el: HTMLElement): boolean => {
      const tag = el.tagName.toUpperCase();
      const style = el.getAttribute('style') || '';
      if (/font-weight:\s*(?:normal|400)/i.test(style)) return false;
      if (tag === 'B' || tag === 'STRONG') return true;
      return /font-weight:\s*(?:bold|bolder|[6-9]00)/i.test(style);
    };

    const boldNodes: HTMLElement[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (isBoldElement(el)) {
          boldNodes.push(el);
          return;
        }
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]);
        }
      }
    };
    walk(doc.body);

    for (const el of boldNodes) {
      const content = (el.textContent || '').trim();
      if (content) {
        const marker = doc.createTextNode(` **${content}** `);
        el.parentNode?.replaceChild(marker, el);
      }
    }

    const blocks = doc.body.querySelectorAll('p, div, li, tr, br, h1, h2, h3, h4, h5, h6');
    blocks.forEach((b) => {
      if (b.tagName.toUpperCase() === 'LI') {
        b.prepend(doc.createTextNode('\n• '));
      } else {
        b.append(doc.createTextNode('\n'));
      }
    });

    const rawResult = doc.body.textContent || '';
    return rawResult
      .replace(/[ \t]+/g, ' ')
      .replace(/\*\*\s*\*\*/g, '')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}

/**
 * Extracts term/definition pairs demarcated by bold styling (`**Term**`).
 * Mitigates:
 * 1. Inline emphasis: anchors to start of line/bullet.
 * 2. Meta/editorial labels: skips Note:, Warning:, Chapter \d+, etc.
 * 3. Whole-sentence bold: checks terminal punctuation, finite verbs, word count, and length ratio.
 */
export function extractBoldTerms(text: string): Array<{ term: string; definition: string }> {
  const normalized = text.replace(/([^\n\s])[ \t]*([•▪‣◦●○])[ \t]*/g, '$1\n$2 ');
  const lines = normalized.split(/\r?\n/);

  const items: Array<{ term: string; definition: string }> = [];
  let current: { term: string; parts: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const definition = current.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (definition.length >= 8 && (definition.length > current.term.length || definition.split(/\s+/).length >= 3)) {
      const totalLen = current.term.length + definition.length;
      if (current.term.length / totalLen <= 0.45) {
        items.push({ term: current.term, definition });
      }
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    const boldMatch = line.match(BOLD_LEAD_PATTERN);
    if (boldMatch) {
      const candidateTerm = boldMatch[1].replace(/\*\*/g, '').trim();
      let remainder = boldMatch[2].trim();

      // Strip delimiter between bold term and remainder (e.g. " : ", " - ", " – ", " — ", " :", ",")
      remainder = remainder.replace(/^(?:\s*[:=]\s*|\s*[-–—]\s*|,\s+)/, '').trim();

      const isValidCandidate =
        candidateTerm.length >= 2 &&
        candidateTerm.length <= 80 &&
        candidateTerm.split(/\s+/).length <= 8 &&
        !/[.!?]$/.test(candidateTerm) &&
        !META_BOLD_LABEL.test(candidateTerm) &&
        !isDisallowedTermWord(candidateTerm) &&
        !FINITE_VERB.test(candidateTerm);

      if (isValidCandidate) {
        flush();
        current = { term: candidateTerm, parts: [] };
        if (remainder) {
          current.parts.push(remainder);
        }
        continue;
      }
    }

    const trailBoldMatch = line.match(/^([\s\S]+?)\s+\*\*([^*]+)\*\*\s*[.!?:]*$/);
    if (trailBoldMatch) {
      const candidateTerm = trailBoldMatch[2].replace(/\*\*/g, '').trim();
      let prefix = trailBoldMatch[1].trim();

      // Strip trailing delimiters like : , - , – , —
      prefix = prefix.replace(/\s*[:=]\s*$|\s*[-–—]\s*$/, '').trim();
      // Strip passive lead before term if present (e.g. "called the", "known as", "termed")
      prefix = prefix.replace(
        /\b(?:is\s+|are\s+)?(?:called|known\s+as|referred\s+to\s+as|termed|designated\s+as|named)(?:\s+(?:the|a|an))?\s*$/i,
        ''
      ).trim();

      const isValidCandidate =
        candidateTerm.length >= 2 &&
        candidateTerm.length <= 80 &&
        candidateTerm.split(/\s+/).length <= 8 &&
        !/[.!?]$/.test(candidateTerm) &&
        !META_BOLD_LABEL.test(candidateTerm) &&
        !isDisallowedTermWord(candidateTerm) &&
        !FINITE_VERB.test(candidateTerm);

      if (isValidCandidate && prefix.length >= 8) {
        flush();
        let formattedPrefix = prefix.replace(/\s+/g, ' ').trim();
        formattedPrefix = formattedPrefix.charAt(0).toUpperCase() + formattedPrefix.slice(1);
        items.push({ term: candidateTerm, definition: formattedPrefix });
        continue;
      }
    }

    if (current) {
      current.parts.push(line);
    }
  }

  flush();
  return items;
}

export function parseSmartClipboard(raw: string, html?: string): ParsedClipboard | null {
  const trimmed = (raw || '').trim();
  const trimmedHtml = (html || '').trim();
  if (!trimmed && !trimmedHtml) return null;

  // Keep `trimmed` untouched for raw-text fallbacks while using a structural
  // working copy for deterministic extraction from PDF clipboard text.
  const normalizedText = trimmed ? normalizePdfSoftWraps(trimmed) : '';

  if (trimmed) {
    const numberedQuestionAnswers = extractNumberedQuestionAnswers(normalizedText);
    if (numberedQuestionAnswers.length > 0) {
      if (numberedQuestionAnswers.length === 1) {
        return { type: 'question_answer', ...numberedQuestionAnswers[0] };
      }
      return { type: 'question_answers', items: numberedQuestionAnswers };
    }

    const numberedTermDefinitions = extractNumberedTermDefinitions(normalizedText);
    if (numberedTermDefinitions.length > 0) {
      if (numberedTermDefinitions.length === 1) {
        return { type: 'single_pair', ...numberedTermDefinitions[0] };
      }
      return { type: 'bulk_terms', items: numberedTermDefinitions };
    }
  }

  // Check for Bold-based Term/Definition Extraction
  let boldCandidates: Array<{ term: string; definition: string }> = [];
  if (trimmedHtml && (/<(?:strong|b)\b/i.test(trimmedHtml) || /font-weight:\s*(?:bold|bolder|[6-9]00)/i.test(trimmedHtml))) {
    const normalizedHtml = normalizeHtmlClipboard(trimmedHtml);
    boldCandidates = extractBoldTerms(normalizedHtml);
  } else if (trimmed.includes('**')) {
    boldCandidates = extractBoldTerms(normalizedText);
  }

  if (boldCandidates.length >= 2) {
    return { type: 'bulk_terms', items: boldCandidates };
  }
  if (boldCandidates.length === 1) {
    return { type: 'single_pair', ...boldCandidates[0] };
  }

  if (!trimmed) return null;

  // 1. Check for Bulk Bulleted Term/Definition List first
  // Supports `:`, ` - `, ` – `, ` — ` delimiters and multi-line wrapped definitions.
  let bulkMatches = extractBulkTerms(normalizedText);
  if (bulkMatches.length >= 1) {
    // At least one delimited term proves this is a definition list, so delimiter-less
    // bulleted siblings can safely be recovered via the Title Case heuristic.
    const withFallback = extractBulkTerms(normalizedText, true);
    if (withFallback.length > bulkMatches.length) bulkMatches = withFallback;
  }
  if (bulkMatches.length === 1) {
    return { type: 'single_pair', ...bulkMatches[0] };
  }
  if (bulkMatches.length >= 2) {
    return { type: 'bulk_terms', items: bulkMatches };
  }

  // 2. Check for Category Heading + Enumeration Blocks
  // Format: Non-bullet header followed by >= 2 bulleted lines (o, •, -, *, 1., a., etc.)
  const lines = normalizedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const enumBlocks: Array<{ header: string; items: string[] }> = [];
  let currentBlock: { header: string; items: string[] } | null = null;
  // Requires a real marker followed by whitespace, so prose lines are never mistaken for bullets
  const bulletRegex = /^(?:[o•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[a-zA-Z][.)])\s+(.*)$/;

  for (const line of lines) {
    const bulletMatch = line.match(bulletRegex);
    if (bulletMatch) {
      if (!currentBlock) currentBlock = { header: 'General Concepts', items: [] };
      const itemText = bulletMatch[1].trim();
      if (itemText) {
        currentBlock.items.push(itemText);
      }
    } else {
      if (currentBlock && currentBlock.items.length >= 2) {
        enumBlocks.push(currentBlock);
      }
      currentBlock = { header: line, items: [] };
    }
  }
  if (currentBlock && currentBlock.items.length >= 2) {
    enumBlocks.push(currentBlock);
  }
  if (enumBlocks.length > 0 && enumBlocks.some((b) => b.items.length >= 2)) {
    return { type: 'enumeration_blocks', blocks: enumBlocks };
  }

  // 3. Check for Single Term/Definition Pair (TSV, Key-Value, heading blocks, or 2-line break)
  // 3a. TSV
  if (normalizedText.includes('\t')) {
    const parts = normalizedText.split('\t');
    if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
      return {
        type: 'single_pair',
        term: parts[0].trim(),
        definition: parts.slice(1).join('\t').trim()
      };
    }
  }

  // 3b. Key-Value Delimiters (: , - , – , — , =)
  // Protects compound words like "Object-oriented" by requiring spaces around dashes
  // Also avoids matching protocol URLs like "http://" by demanding whitespace or isolated symbol
  const kvMatch = normalizedText.match(/^([^\n]+?)\s*(?::\s+|\s[-–—]\s|=)\s*([\s\S]+)$/);
  if (kvMatch && kvMatch[1].trim() && kvMatch[2].trim()) {
    return {
      type: 'single_pair',
      term: kvMatch[1].trim(),
      // Soft wraps from the source document are flattened into a single line
      definition: kvMatch[2].replace(/\s+/g, ' ').trim()
    };
  }

  // 3c. Conservative standalone heading + paragraph extraction for PDF handouts.
  const headingMatches = extractHeadingBlocks(normalizedText);
  if (headingMatches.length === 1) {
    return { type: 'single_pair', ...headingMatches[0] };
  }
  if (headingMatches.length >= 2) {
    return { type: 'bulk_terms', items: headingMatches };
  }

  // 3d. Two-line break — only when line 1 is a label, not a wrapped clause of prose.
  // Without this guard, a sentence that happens to wrap once ("...for people and things,\nand the
  // marketspace, ...") would be mistaken for a term/definition pair.
  if (lines.length === 2 && isLabelLike(lines[0]) && lines[1]) {
    return {
      type: 'single_pair',
      term: lines[0],
      definition: lines[1]
    };
  }

  // 3e. Natural Definition Verb Split (e.g. "computer graphics describes the use of...")
  // Captures textbook definitions copied from PDFs where all styling and punctuation delimiters are absent.
  const verbMatches = extractDefinitionVerbPairs(normalizedText);
  if (verbMatches.length >= 2) {
    return { type: 'bulk_terms', items: verbMatches };
  }

  const verbMatch = verbMatches[0] || splitPassiveDefinition(normalizedText);
  if (verbMatch) {
    return {
      type: 'single_pair',
      term: verbMatch.term,
      definition: verbMatch.definition
    };
  }

  // 4. Check for Inline Appositive Compound Definitions
  // Handles natural-language clauses like:
  // "the marketplace, the physical world for people and things, and the marketspace, a virtual world of information."
  // or "Front-end, the client-facing presentation layer; Back-end, the server-side logic and database operations."
  // Soft line wraps from PDF/slide copies are joined first so clause detection is not line-bound.
  const cleaned = normalizedText.replace(/\s*\r?\n\s*/g, ' ').replace(/\s+/g, ' ').replace(/\.+$/, '').trim();

  // 4a. Strict alternating clauses: term, definition, term, definition…
  // Handles any number of items and needs no "and" joiner.
  const alternating = extractAlternatingAppositives(cleaned);
  if (alternating.length >= 2) {
    return { type: 'bulk_terms', items: alternating };
  }

  // 4b. Joiner-based split, for lists whose definitions contain their own commas
  let segments: string[] = [];

  if (cleaned.includes(';')) {
    segments = cleaned.split(/;\s*/);
  } else {
    // Splits at ", and " when followed by an appositive clause [term], [definition]
    const conjMatch = cleaned.match(/,\s+and\s+(?=(?:(?:the|a|an)\s+)?[a-zA-Z0-9_\-/\s]{1,40},)/i);
    if (conjMatch && conjMatch.index !== undefined) {
      segments = [
        cleaned.slice(0, conjMatch.index).trim(),
        cleaned.slice(conjMatch.index + conjMatch[0].length).trim()
      ];
    }
  }

  if (segments.length >= 2) {
    const appositivePairs: Array<{ term: string; definition: string }> = [];
    for (const segment of segments) {
      const segTrim = segment.trim().replace(/^and\s+/i, '');
      const commaIdx = segTrim.indexOf(',');
      if (commaIdx > 0) {
        const rawTerm = segTrim.slice(0, commaIdx).trim();
        const rawDef = segTrim.slice(commaIdx + 1).trim();
        const term = rawTerm.replace(/^(?:the|a|an)\s+/i, '').trim();

        if (term && isAppositiveTerm(rawTerm) && isAppositiveDefinition(rawDef, term)) {
          appositivePairs.push({
            term,
            definition: rawDef
          });
        }
      }
    }
    if (appositivePairs.length >= 2) {
      return { type: 'bulk_terms', items: appositivePairs };
    }
  }

  return null;
}

/**
 * Pairs comma/semicolon separated clauses strictly as term, definition, term, definition…
 *
 * Bails out entirely (rather than guessing) unless every clause in a term position is
 * short and label-shaped and every definition position is a longer descriptive phrase.
 * That strictness is what keeps ordinary comma-heavy prose from being shredded into cards.
 */
function extractAlternatingAppositives(sentence: string): Array<{ term: string; definition: string }> {
  const chunks = sentence
    .split(/[;,]\s*/)
    .map((chunk) => chunk.trim().replace(/^and\s+/i, '').trim())
    .filter(Boolean);

  if (chunks.length < 4 || chunks.length % 2 !== 0) return [];

  const pairs: Array<{ term: string; definition: string }> = [];
  for (let i = 0; i < chunks.length; i += 2) {
    const rawTerm = chunks[i];
    const definition = chunks[i + 1];
    const term = rawTerm.replace(/^(?:the|a|an)\s+/i, '').trim();

    if (!term || !definition) return [];
    if (!isAppositiveTerm(rawTerm)) return [];
    if (!isAppositiveDefinition(definition, term)) return [];

    pairs.push({ term, definition });
  }

  return pairs;
}

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
  /\b(?:is|are|was|were|be|been|being|am|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must|refers|means|includes|consists|focuses|allows|provides)\b/i;

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
  if (/[,;:]/.test(value)) return false;
  if (/[.!?]$/.test(value)) return false;
  if (/\b(?:and|or|the|is|are|was|were|that|which)\b$/i.test(value)) return false;
  return value.length <= 80 && value.split(/\s+/).length <= 10;
}

/**
 * A long or sentence-like line after a label-shaped heading is likely the
 * heading's wrapped definition rather than the right side of a delimiter.
 */
function isDefinitionLikeLine(value: string): boolean {
  const line = value.trim();
  return line.length >= 40 || /[,.;!?]/.test(line) || /^(?:a|an|the|this|that|these|those|often|when|where|developers?|it|they)\b/i.test(line);
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

    // Continuation line of the definition currently being built.
    if (current) current.parts.push(body);
  }
  flush();

  return items;
}

export function parseSmartClipboard(raw: string): ParsedClipboard | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const numberedQuestionAnswers = extractNumberedQuestionAnswers(trimmed);
  if (numberedQuestionAnswers.length > 0) {
    if (numberedQuestionAnswers.length === 1) {
      return { type: 'question_answer', ...numberedQuestionAnswers[0] };
    }
    return { type: 'question_answers', items: numberedQuestionAnswers };
  }

  const numberedTermDefinitions = extractNumberedTermDefinitions(trimmed);
  if (numberedTermDefinitions.length > 0) {
    if (numberedTermDefinitions.length === 1) {
      return { type: 'single_pair', ...numberedTermDefinitions[0] };
    }
    return { type: 'bulk_terms', items: numberedTermDefinitions };
  }

  // 1. Check for Bulk Bulleted Term/Definition List first
  // Supports `:`, ` - `, ` – `, ` — ` delimiters and multi-line wrapped definitions.
  let bulkMatches = extractBulkTerms(trimmed);
  if (bulkMatches.length >= 1) {
    // At least one delimited term proves this is a definition list, so delimiter-less
    // bulleted siblings can safely be recovered via the Title Case heuristic.
    const withFallback = extractBulkTerms(trimmed, true);
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
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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

  // 3. Check for Single Term/Definition Pair (TSV, Key-Value, or 2-line break)
  // 3a. TSV
  if (trimmed.includes('\t')) {
    const parts = trimmed.split('\t');
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
  const kvMatch = trimmed.match(/^([^\n]+?)\s*(?::\s+|\s[-–—]\s|=)\s*([\s\S]+)$/);
  if (kvMatch && kvMatch[1].trim() && kvMatch[2].trim()) {
    return {
      type: 'single_pair',
      term: kvMatch[1].trim(),
      // Soft wraps from the source document are flattened into a single line
      definition: kvMatch[2].replace(/\s+/g, ' ').trim()
    };
  }

  // 3c. Two-line break — only when line 1 is a label, not a wrapped clause of prose.
  // Without this guard, a sentence that happens to wrap once ("...for people and things,\nand the
  // marketspace, ...") would be mistaken for a term/definition pair.
  if (lines.length === 2 && isLabelLike(lines[0]) && lines[1]) {
    return {
      type: 'single_pair',
      term: lines[0],
      definition: lines[1]
    };
  }

  // 4. Check for Inline Appositive Compound Definitions
  // Handles natural-language clauses like:
  // "the marketplace, the physical world for people and things, and the marketspace, a virtual world of information."
  // or "Front-end, the client-facing presentation layer; Back-end, the server-side logic and database operations."
  // Soft line wraps from PDF/slide copies are joined first so clause detection is not line-bound.
  const cleaned = trimmed.replace(/\s*\r?\n\s*/g, ' ').replace(/\s+/g, ' ').replace(/\.+$/, '').trim();

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

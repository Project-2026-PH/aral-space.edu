import { GrammarIssue } from './types';

const COMMON_TYPOS: Record<string, string> = {
  teh: 'the',
  taht: 'that',
  waht: 'what',
  thier: 'their',
  recieve: 'receive',
  recieved: 'received',
  recieving: 'receiving',
  seperate: 'separate',
  seperated: 'separated',
  untill: 'until',
  definately: 'definitely',
  occured: 'occurred',
  occurence: 'occurrence',
  beleive: 'believe',
  beleived: 'believed',
  goverment: 'government',
  enviroment: 'environment',
  wierd: 'weird',
  truely: 'truly',
  tommorow: 'tomorrow',
  timmorow: 'tomorrow',
  alot: 'a lot',
  wich: 'which',
  becuase: 'because',
  calender: 'calendar',
  begining: 'beginning',
  succesful: 'successful',
  neccessary: 'necessary',
  completly: 'completely',
  suprise: 'surprise',
  adress: 'address',
  effectivity: 'effectiveness',
  productivities: 'productivity'
};

const VOWEL_EXCEPTIONS_USE_A = new Set(['university', 'universal', 'universe', 'uniform', 'unique', 'user', 'useful', 'european', 'one', 'once']);
const CONSONANT_EXCEPTIONS_USE_AN = new Set(['hour', 'hours', 'hourly', 'honest', 'honesty', 'honor', 'honorable', 'heir']);

export function runLocalGrammarRules(text: string): GrammarIssue[] {
  if (!text || !text.trim()) return [];

  const issues: GrammarIssue[] = [];

  function addIssue(
    from: number,
    to: number,
    originalText: string,
    message: string,
    replacements: string[],
    ruleType: 'spelling' | 'grammar' | 'style',
    ruleCategory: string
  ) {
    issues.push({
      id: `local-${from}-${to}-${originalText.toLowerCase()}`,
      from,
      to,
      originalText,
      message,
      replacements,
      ruleType,
      ruleCategory
    });
  }

  // 1. Common Typos / Spelling
  const wordRegex = /\b[A-Za-z]+(?:'[A-Za-z]+)?\b/g;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRegex.exec(text)) !== null) {
    const rawWord = wordMatch[0];
    const lower = rawWord.toLowerCase();
    const replacement = COMMON_TYPOS[lower];

    if (replacement) {
      const isCapitalized = rawWord[0] === rawWord[0].toUpperCase() && rawWord[0] !== rawWord[0].toLowerCase();
      const formattedReplacement = isCapitalized
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;

      addIssue(
        wordMatch.index,
        wordMatch.index + rawWord.length,
        rawWord,
        `Possible typo. Did you mean "${formattedReplacement}"?`,
        [formattedReplacement],
        'spelling',
        'Typo'
      );
    }
  }

  // 2. Repeated Words (e.g. "the the")
  const repeatedRegex = /\b([A-Za-z]+)\s+(\1)\b/gi;
  let repeatedMatch: RegExpExecArray | null;
  while ((repeatedMatch = repeatedRegex.exec(text)) !== null) {
    const fullMatch = repeatedMatch[0];
    const firstWord = repeatedMatch[1];
    addIssue(
      repeatedMatch.index,
      repeatedMatch.index + fullMatch.length,
      fullMatch,
      `Repeated word "${firstWord}".`,
      [firstWord],
      'grammar',
      'Redundancy'
    );
  }

  // 3. Article Agreement: "a" vs "an"
  const articleRegex = /\b(a|an)\s+([A-Za-z]+)\b/gi;
  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = articleRegex.exec(text)) !== null) {
    const article = articleMatch[1];
    const nextWord = articleMatch[2];
    const articleLower = article.toLowerCase();
    const nextWordLower = nextWord.toLowerCase();

    const startsWithVowelLetter = /^[aeiou]/i.test(nextWordLower);

    if (articleLower === 'a') {
      if (startsWithVowelLetter && !VOWEL_EXCEPTIONS_USE_A.has(nextWordLower)) {
        const replacementArticle = article[0] === 'A' ? 'An' : 'an';
        addIssue(
          articleMatch.index,
          articleMatch.index + article.length,
          article,
          `Use "${replacementArticle}" before vowel sounds.`,
          [replacementArticle],
          'grammar',
          'Articles'
        );
      }
    } else if (articleLower === 'an') {
      if (!startsWithVowelLetter && !CONSONANT_EXCEPTIONS_USE_AN.has(nextWordLower)) {
        const replacementArticle = article[0] === 'A' ? 'A' : 'a';
        addIssue(
          articleMatch.index,
          articleMatch.index + article.length,
          article,
          `Use "${replacementArticle}" before consonant sounds.`,
          [replacementArticle],
          'grammar',
          'Articles'
        );
      }
    }
  }

  // 4. Modal verbs: could of -> could have
  const modalOfRegex = /\b(could|should|would|might|must)\s+of\b/gi;
  let modalMatch: RegExpExecArray | null;
  while ((modalMatch = modalOfRegex.exec(text)) !== null) {
    const modal = modalMatch[1];
    const replacement = `${modal} have`;
    addIssue(
      modalMatch.index,
      modalMatch.index + modalMatch[0].length,
      modalMatch[0],
      `Did you mean "${replacement}"?`,
      [replacement],
      'grammar',
      'Common Confusion'
    );
  }

  // 5. Homophones & Confusions
  const homophones: Array<{ regex: RegExp; replace: (m: RegExpExecArray) => string; msg: string }> = [
    {
      regex: /\byour\s+(welcome|right|wrong|leaving|going|the|a)\b/gi,
      replace: (m) => `${m[0].startsWith('Y') ? "You're" : "you're"} ${m[1]}`,
      msg: "Did you mean 'you're'?"
    },
    {
      regex: /\btheir\s+(is|are|was|were)\b/gi,
      replace: (m) => `${m[0].startsWith('T') ? 'There' : 'there'} ${m[1]}`,
      msg: "Did you mean 'there'?"
    },
    {
      regex: /\bits\s+(a|an|the|my|your|not|important|cool|great|time)\b/gi,
      replace: (m) => `${m[0].startsWith('I') ? "It's" : "it's"} ${m[1]}`,
      msg: "Did you mean 'it's' (it is)?"
    },
    {
      regex: /\bleads?\s+to\s+increases?\s+productivit(?:y|ies)\b/gi,
      replace: () => 'leads to increased productivity',
      msg: "Did you mean 'leads to increased productivity'?"
    },
    {
      regex: /\bof\s+an\s+within\b/gi,
      replace: () => 'within',
      msg: "Redundant words. Did you mean 'within'?"
    },
    {
      regex: /\baccounted\s+roles\b/gi,
      replace: () => 'accountable roles',
      msg: "Word choice: Did you mean 'accountable roles'?"
    }
  ];

  for (const h of homophones) {
    let match: RegExpExecArray | null;
    while ((match = h.regex.exec(text)) !== null) {
      const replacement = h.replace(match);
      addIssue(
        match.index,
        match.index + match[0].length,
        match[0],
        h.msg,
        [replacement],
        'grammar',
        'Confused Words'
      );
    }
  }

  // 6. Capitalization after sentence start or terminal punctuation
  const capitalRegex = /(?:^|[.!?]\s+)([a-z])\b/g;
  let capitalMatch: RegExpExecArray | null;
  while ((capitalMatch = capitalRegex.exec(text)) !== null) {
    const fullPrefix = capitalMatch[0];
    const letter = capitalMatch[1];
    const letterIndex = capitalMatch.index + (fullPrefix.length - 1);
    const replacement = letter.toUpperCase();
    addIssue(
      letterIndex,
      letterIndex + 1,
      letter,
      'Sentence should start with a capital letter.',
      [replacement],
      'style',
      'Capitalization'
    );
  }

  // 7. Space before punctuation
  const punctSpaceRegex = /\s+([,.:;?!])/g;
  let punctMatch: RegExpExecArray | null;
  while ((punctMatch = punctSpaceRegex.exec(text)) !== null) {
    const punct = punctMatch[1];
    addIssue(
      punctMatch.index,
      punctMatch.index + punctMatch[0].length,
      punctMatch[0],
      'Unnecessary space before punctuation.',
      [punct],
      'style',
      'Punctuation'
    );
  }

  // Deduplicate and sort by offset
  const sorted = issues.sort((a, b) => a.from - b.from);
  const deduped: GrammarIssue[] = [];
  for (const issue of sorted) {
    const overlaps = deduped.some(
      (prev) => (issue.from >= prev.from && issue.from < prev.to) || (issue.to > prev.from && issue.to <= prev.to)
    );
    if (!overlaps) {
      deduped.push(issue);
    }
  }

  return deduped;
}

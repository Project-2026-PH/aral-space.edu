const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const capitalizeFirstAlphabetic = (value: string): string =>
  value.replace(/[A-Za-z]/, (character) => character.toUpperCase());

export function convertToQuestion(text: string, term: string): string {
  if (!text || !term.trim()) {
    return capitalizeFirstAlphabetic(text);
  }

  const escapedTerm = escapeRegExp(term.trim());
  const termPattern = new RegExp(`\\b${escapedTerm}\\b`, 'gi');

  if (!termPattern.test(text)) {
    return capitalizeFirstAlphabetic(text);
  }

  const leadingPattern = new RegExp(
    `\\b(In|With|During|For)\\s+${escapedTerm}\\b\\s*,?\\s*`,
    'i'
  );
  let result = text.replace(leadingPattern, 'Here, ');

  const repeatedOpenerPattern = new RegExp(
    `\\b(In|With|During|For)\\s+${escapedTerm}\\b\\s*,?\\s*(?:we\\s+)?`,
    'gi'
  );
  result = result.replace(repeatedOpenerPattern, 'We also ');

  const namingPredicatePattern = new RegExp(
    `(\\b(?:is|are|was|were)\\b(?:\\s+\\w+)*\\s+(?:called|known\\s+as|referred\\s+to\\s+as)\\s+)${escapedTerm}\\b\\s*([.!?])?`,
    'gi'
  );
  result = result.replace(
    namingPredicatePattern,
    (match, prefix: string, punctuation: string | undefined, offset: number, source: string) => {
      const isFinalSentence = /^\s*$/.test(source.slice(offset + match.length));
      return `${prefix}what${isFinalSentence ? '?' : punctuation ?? ''}`;
    }
  );

  const copularPredicatePattern = new RegExp(
    `(\\b(?:is|are|was|were)\\s+)${escapedTerm}\\b\\s*([.!?])?`,
    'gi'
  );
  result = result.replace(
    copularPredicatePattern,
    (match, prefix: string, punctuation: string | undefined, offset: number, source: string) => {
      const isFinalSentence = /^\s*$/.test(source.slice(offset + match.length));
      return `${prefix}known as what${isFinalSentence ? '?' : punctuation ?? ''}`;
    }
  );

  result = result.replace(termPattern, 'this process').trim();
  if (!/\?\s*$/.test(result)) {
    result = `${result} What is this operation called?`;
  }

  return capitalizeFirstAlphabetic(result);
}

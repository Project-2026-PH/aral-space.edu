const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function convertToQuestion(text: string, term: string): string {
  if (!text || !term.trim()) {
    return text;
  }

  const escapedTerm = escapeRegExp(term.trim());
  const termPattern = new RegExp(`\\b${escapedTerm}\\b`, 'gi');

  if (!termPattern.test(text)) {
    return text;
  }

  const leadingPattern = new RegExp(
    `\\b(In|With|During|For)\\s+${escapedTerm}\\b\\s*,?\\s*`,
    'i'
  );
  let result = text.replace(leadingPattern, 'Here, ');

  const predicatePattern = new RegExp(
    `(\\b(?:is|are|was|were)\\s+)${escapedTerm}\\b`,
    'i'
  );
  result = result.replace(predicatePattern, '$1known as what');

  const repeatedOpenerPattern = new RegExp(
    `\\b(In|With|During|For)\\s+${escapedTerm}\\b\\s*,?\\s*(?:we\\s+)?`,
    'gi'
  );
  result = result.replace(repeatedOpenerPattern, 'We also ');
  result = result.replace(termPattern, 'this process');

  result = result.trim();
  return /\?\s*$/.test(result) ? result : `${result} What is this operation called?`;
}

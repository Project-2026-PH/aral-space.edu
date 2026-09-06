const SMALL_NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const ORDINAL_NUMBER_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
};

const NUMBER_SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
};

const IRREGULAR_SINGULARS: Record<string, string> = {
  analyses: 'analysis',
  axes: 'axis',
  bases: 'basis',
  cacti: 'cactus',
  children: 'child',
  crises: 'crisis',
  diagnoses: 'diagnosis',
  feet: 'foot',
  geese: 'goose',
  hypotheses: 'hypothesis',
  indices: 'index',
  knives: 'knife',
  matrices: 'matrix',
  men: 'man',
  mice: 'mouse',
  people: 'person',
  series: 'series',
  species: 'species',
  teeth: 'tooth',
  theses: 'thesis',
  women: 'woman',
};

const ROMAN_NUMERAL_PATTERN = /^(?=[mdclxvi]+$)m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
const ROMAN_NUMERAL_VALUES: Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1_000,
};

function romanNumeralToArabic(token: string): string | null {
  if (!ROMAN_NUMERAL_PATTERN.test(token)) return null;

  let total = 0;
  let previous = 0;
  for (const character of [...token].reverse()) {
    const value = ROMAN_NUMERAL_VALUES[character];
    if (value < previous) total -= value;
    else {
      total += value;
      previous = value;
    }
  }
  return String(total);
}

function parseNumberWords(tokens: string[], start: number): { value: number; nextIndex: number } | null {
  let total = 0;
  let current = 0;
  let index = start;
  let consumed = false;

  while (index < tokens.length) {
    const token = tokens[index];
    const smallValue = SMALL_NUMBER_WORDS[token];
    const ordinalValue = ORDINAL_NUMBER_WORDS[token];
    const scale = NUMBER_SCALES[token];

    if (smallValue !== undefined || ordinalValue !== undefined) {
      current += smallValue ?? ordinalValue;
      consumed = true;
      index += 1;
      continue;
    }

    if (scale !== undefined) {
      total += (current || 1) * scale;
      current = 0;
      consumed = true;
      index += 1;
      continue;
    }

    break;
  }

  return consumed ? { value: total + current, nextIndex: index } : null;
}

function singularizeToken(token: string): string {
  const irregular = IRREGULAR_SINGULARS[token];
  if (irregular) return irregular;

  if (token.length <= 3) return token;
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith('ses') && token.slice(0, -2).endsWith('s')) return token.slice(0, -2);
  if (token.endsWith('s') && !/(ss|is|us)$/.test(token)) return token.slice(0, -1);
  return token;
}

function tokenize(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function canonicalizeTokens(tokens: string[]): string[] {
  const canonical: string[] = [];

  for (let index = 0; index < tokens.length;) {
    const number = parseNumberWords(tokens, index);
    if (number) {
      canonical.push(String(number.value));
      index = number.nextIndex;
      continue;
    }

    const roman = romanNumeralToArabic(tokens[index]);
    canonical.push(roman || singularizeToken(tokens[index]));
    index += 1;
  }

  return canonical;
}

function levenshteinDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const distance = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost
      );
      current[rightIndex] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }

    if (rowMinimum > limit) return limit + 1;
    previous = current;
  }

  return previous[right.length];
}

function matchesWithMinorTypo(submitted: string[], expected: string[]): boolean {
  if (submitted.length !== expected.length) return false;

  let changedTokens = 0;
  let totalDistance = 0;
  for (let index = 0; index < expected.length; index += 1) {
    if (submitted[index] === expected[index]) continue;

    const token = expected[index];
    const limit = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
    const distance = levenshteinDistance(submitted[index], token, limit);
    if (distance > limit) return false;

    changedTokens += 1;
    totalDistance += distance;
  }

  return changedTokens === 1 && totalDistance <= 2;
}

export function normalizeAnswerForComparison(value: string): string {
  return canonicalizeTokens(tokenize(value)).join(' ');
}

export function areAnswersEquivalent(submitted: string, expected: string): boolean {
  const submittedTokens = canonicalizeTokens(tokenize(submitted));
  const expectedTokens = canonicalizeTokens(tokenize(expected));

  if (submittedTokens.length === 0 || expectedTokens.length === 0) return false;
  if (submittedTokens.join(' ') === expectedTokens.join(' ')) return true;
  return matchesWithMinorTypo(submittedTokens, expectedTokens);
}

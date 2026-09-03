import { RawAiQuestion, VerbatimTermPair } from '@quiz-creator/types';

export class VerbatimQuizBuilder {
  /**
   * Normalizes whitespace, ligatures, and typographic punctuation to prevent
   * false rejection of valid quotes caused by PDF line wraps or character encoding quirks.
   */
  static normalizeForVerification(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFKD')
      .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, '') // Remove soft hyphens & zero-width chars
      .replace(/[\u2018\u2019\u201b\u2032]/g, "'")       // Straight single quotes
      .replace(/[\u201c\u201d\u201f\u2033]/g, '"')       // Straight double quotes
      .replace(/[\u2013\u2014]/g, '-')                   // En/Em dashes
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .replace(/\s+/g, ' ')                              // Collapse multi-spaces and newlines
      .trim()
      .toLowerCase();
  }

  /**
   * Verifies whether the extracted definition exists verbatim (character-exact up to whitespace)
   * within the source document.
   */
  static verifyVerbatimSubstring(sourceText: string, definitionSnippet: string): boolean {
    if (!sourceText || !definitionSnippet) return false;
    const normSource = VerbatimQuizBuilder.normalizeForVerification(sourceText);
    const normSnippet = VerbatimQuizBuilder.normalizeForVerification(definitionSnippet);
    if (!normSnippet) return false;
    return normSource.includes(normSnippet);
  }

  /**
   * Deterministically validates extracted pairs against document text and programmatically
   * builds multiple-choice questions by sampling distractors from other extracted definitions.
   */
  static assembleVerbatimQuiz(
    rawPairs: VerbatimTermPair[],
    fullSourceText: string,
    targetCount: number = 15
  ): RawAiQuestion[] {
    // Filter strictly for verified verbatim occurrences
    const validPairs = rawPairs.filter((p) =>
      p &&
      typeof p.term === 'string' &&
      p.term.trim().length > 0 &&
      typeof p.verbatim_definition === 'string' &&
      p.verbatim_definition.trim().length > 0 &&
      VerbatimQuizBuilder.verifyVerbatimSubstring(fullSourceText, p.verbatim_definition)
    );

    // Enforce minimum yield (minimum 4 unique pairs required for 4 MCQ options)
    const uniquePairs: VerbatimTermPair[] = [];
    const seenDefs = new Set<string>();
    for (const p of validPairs) {
      const norm = VerbatimQuizBuilder.normalizeForVerification(p.verbatim_definition);
      if (!seenDefs.has(norm)) {
        seenDefs.add(norm);
        uniquePairs.push(p);
      }
    }

    if (uniquePairs.length < 4) {
      throw new Error(
        `Insufficient verbatim definitions verified in source text (${uniquePairs.length}/4 minimum). At least 4 distinct verbatim definitions are required to assemble 4-choice questions.`
      );
    }

    const selectedPairs = uniquePairs.slice(0, targetCount);
    const questions: RawAiQuestion[] = [];

    for (let i = 0; i < selectedPairs.length; i++) {
      const current = selectedPairs[i];

      // Pool candidate distractors from other verified definitions
      // Prefer same chapter if >= 3 available, else use all other definitions
      const sameChapterOthers = uniquePairs.filter(
        (p) => p !== current && p.chapter && current.chapter && p.chapter === current.chapter
      );

      const distractorPool =
        sameChapterOthers.length >= 3
          ? sameChapterOthers
          : uniquePairs.filter((p) => p !== current);

      // Deterministically or randomly shuffle pool to pick 3 distractors
      const shuffled = [...distractorPool].sort(() => 0.5 - Math.random());
      const chosenDistractors = shuffled.slice(0, 3).map((p) => p.verbatim_definition);

      // Randomize correct option index (0..3)
      const correctIndex = Math.floor(Math.random() * 4);
      const options = [...chosenDistractors];
      options.splice(correctIndex, 0, current.verbatim_definition);

      questions.push({
        question: `Which of the following is the exact definition of "${current.term}"?`,
        options,
        correct_answer: correctIndex,
        explanation: `Verbatim excerpt from page ${current.source_page}: "${current.verbatim_definition}"`,
        source_pages: [current.source_page],
        chapter: current.chapter
      });
    }

    return questions;
  }
}

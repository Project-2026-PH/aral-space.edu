import { QuizQuestion } from '@quiz-creator/types';

const DEFAULT_OPTION_COUNT = 4;

function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function getCorrectAnswer(question: QuizQuestion): string {
  return question.answer_text?.trim() || question.options[question.correct_answer]?.trim() || '';
}

export class QuizTransformService {
  /**
   * Fills sparse multiple-choice cards from the quiz's existing correct answers.
   * This is intentionally ephemeral: authoring data remains sparse and no extra
   * database or AI calls are needed when a practice mode starts.
   */
  static prepareQuestionsForOptions(
    questions: QuizQuestion[],
    optionCount: number = DEFAULT_OPTION_COUNT
  ): QuizQuestion[] {
    return questions.map((question, index) => {
      // Enumeration cards use their numeric answer_text as the answer key;
      // their options are the listed items, not multiple-choice options.
      if (question.question_type === 'enumeration') {
        return question;
      }

      const correctAnswer = getCorrectAnswer(question);
      if (!correctAnswer) return question;

      const correctKey = normalizeForComparison(correctAnswer);
      const entries: Array<{ text: string; originalIndex: number }> = [];
      const optionKeys = new Set<string>();

      question.options.forEach((option, originalIndex) => {
        const text = option.trim();
        const key = normalizeForComparison(text);
        if (!key || optionKeys.has(key)) return;
        optionKeys.add(key);
        entries.push({ text, originalIndex });
      });

      if (!optionKeys.has(correctKey)) {
        entries.unshift({ text: correctAnswer, originalIndex: -1 });
        optionKeys.add(correctKey);
      }

      // Moving threshold: upcoming questions first, then preceding questions for end items
      const candidateIndices: number[] = [];
      for (let j = index + 1; j < questions.length; j++) {
        candidateIndices.push(j);
      }
      for (let j = index - 1; j >= 0; j--) {
        candidateIndices.push(j);
      }

      for (const candidateIndex of candidateIndices) {
        if (entries.length >= optionCount) break;
        const answer = getCorrectAnswer(questions[candidateIndex]);
        if (!answer) continue;
        const key = normalizeForComparison(answer);
        if (key === correctKey || optionKeys.has(key)) continue;
        optionKeys.add(key);
        entries.push({ text: answer, originalIndex: -1 });
      }

      if (entries.length < optionCount) {
        for (const candidateIndex of candidateIndices) {
          if (entries.length >= optionCount) break;
          for (const opt of questions[candidateIndex].options) {
            if (entries.length >= optionCount) break;
            const text = opt.trim();
            if (!text) continue;
            const key = normalizeForComparison(text);
            if (key === correctKey || optionKeys.has(key)) continue;
            optionKeys.add(key);
            entries.push({ text, originalIndex: -1 });
          }
        }
      }

      const correctIndex = entries.findIndex(
        (entry) => normalizeForComparison(entry.text) === correctKey
      );
      const distractorExplanations = question.distractor_explanations
        ? Object.fromEntries(
            entries.flatMap((entry, index) => {
              const explanation = entry.originalIndex >= 0
                ? question.distractor_explanations?.[entry.originalIndex]
                : undefined;
              return explanation ? [[index, explanation]] : [];
            })
          )
        : question.distractor_explanations;

      return {
        ...question,
        options: entries.map((entry) => entry.text),
        correct_answer: correctIndex >= 0 ? correctIndex : 0,
        answer_text: correctAnswer,
        distractor_explanations: distractorExplanations
      };
    });
  }

  static generateReverseQuestions(questions: QuizQuestion[]): QuizQuestion[] {
    return questions.map((q) => {
      const correctOption = q.options[q.correct_answer] || q.answer_text || '';
      const reversedPrompt = `Which term matches: "${q.question_text}"?`;
      const otherOptions = q.options.filter((_, idx) => idx !== q.correct_answer);
      const newOptions = [correctOption, ...otherOptions];

      return {
        ...q,
        id: `${q.id}-reverse`,
        question_text: reversedPrompt,
        options: newOptions,
        correct_answer: 0,
        explanation: q.explanation ? `Reverse concept: ${q.explanation}` : null
      };
    });
  }

  /**
   * Rephrases a definition for an identification question without exposing its answer term.
   *
   * Definitions copied from reference material often begin with the answer, for example:
   * `The 802.11 (Wi-Fi) standard applies to WLANs...`. Replacing only the exact term
   * keeps the useful definition while preventing the answer from being shown in the prompt.
   */
  static phraseIdentificationPrompt(definition: string, term: string): string {
    let cleanDefinition = definition.trim();
    const cleanTerm = term.trim();
    if (!cleanDefinition || !cleanTerm) return cleanDefinition;

    const escapedTerm = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const leadingTermPattern = new RegExp(
      `^(?:The\\s+)?${escapedTerm}(?:\\s+(\\([^)]*\\)))?\\s+([a-z][\\w-]*)`,
      'i'
    );
    const leadingTerm = cleanDefinition.match(leadingTermPattern);

    if (leadingTerm) {
      const descriptor = leadingTerm[1] ? ` ${leadingTerm[1].trim()}` : '';
      const remainder = cleanDefinition.slice(leadingTerm[0].length);
      const nounOrVerb = leadingTerm[2];
      const verbLed = /^(?:is|are|was|were|has|have|had|does|do|did|can|could|will|would|may|might|must|refers|means|includes|consists|focuses|allows|provides|uses|applies|supports|describes|involves|deals)$/i.test(nounOrVerb);

      cleanDefinition = verbLed
        ? `This${descriptor} ${nounOrVerb}${remainder}`
        : `This is the ${nounOrVerb}${descriptor}${remainder ? ` that${remainder}` : ''}`;
    }

    const contextualPatterns: Array<[RegExp, string]> = [
      [new RegExp(`\\bthe\\s+${escapedTerm}\\s+(specifications?)`, 'gi'), 'these $1'],
      [new RegExp(`\\bthe\\s+${escapedTerm}\\s+(standard|amendment|process|method|system)`, 'gi'), 'this $1']
    ];
    for (const [pattern, replacement] of contextualPatterns) {
      cleanDefinition = cleanDefinition.replace(pattern, replacement);
    }

    // Match the complete term, not a prefix of a related term such as `802.11a`.
    const termPattern = new RegExp(
      `(^|[^A-Za-z0-9])${escapedTerm}(?![A-Za-z0-9])`,
      'gi'
    );
    let result = cleanDefinition.replace(termPattern, '$1this concept').replace(/\s+/g, ' ').trim();

    // If definition starts with a subject + passive verb (e.g. "Pixel data is stored in a region of memory")
    // and does not contain the term, rephrase to "This is stored in a region of memory"
    const passiveMatch = result.match(/^([A-Za-z0-9\s]{2,40}?)\s+(is|are|was|were)\s+([a-z]+ed\b[\s\S]*)$/i);
    if (passiveMatch && !new RegExp(`\\b${escapedTerm}\\b`, 'i').test(passiveMatch[1])) {
      const verb = passiveMatch[2];
      const remainder = passiveMatch[3];
      result = `This ${verb} ${remainder}`.replace(/\s+/g, ' ').trim();
    }

    return result;
  }

  /**
   * Paraphrases a question or definition into a declarative statement for a given term.
   */
  static paraphraseToStatement(questionText: string, term: string): string {
    let cleanText = questionText.trim();
    if (!cleanText) return term;

    // Strip wrapping outer quotes if present
    if (
      (cleanText.startsWith('"') && cleanText.endsWith('"')) ||
      (cleanText.startsWith("'") && cleanText.endsWith("'")) ||
      (cleanText.startsWith('“') && cleanText.endsWith('”'))
    ) {
      cleanText = cleanText.slice(1, -1).trim();
    }

    const patterns: [RegExp, (t: string) => string][] = [
      [/^It\s+is\s+defined\s+as\b/i, (t) => `${t} is defined as`],
      [/^It\s+involves\b/i, (t) => `${t} involves`],
      [/^It\s+refers\s+to\b/i, (t) => `${t} refers to`],
      [/^It\s+describes\b/i, (t) => `${t} describes`],
      [/^It\s+is\s+the\s+process\s+of\b/i, (t) => `${t} is the process of`],
      [/^It\s+is\s+a\s+process\s+of\b/i, (t) => `${t} is a process of`],
      [/^It\s+is\s+an?\b/i, (t) => `${t} is an`],
      [/^It\s+is\b/i, (t) => `${t} is`],
      [/^This\s+refers\s+to\b/i, (t) => `${t} refers to`],
      [/^This\s+involves\b/i, (t) => `${t} involves`],
      [/^This\s+is\b/i, (t) => `${t} is`],
      [/^Refers\s+to\b/i, (t) => `${t} refers to`],
      [/^Defined\s+as\b/i, (t) => `${t} is defined as`],
      [/^The\s+process\s+of\b/i, (t) => `${t} is the process of`],
      [/^A\s+process\s+of\b/i, (t) => `${t} is a process of`],
      [/^Is\s+the\s+process\s+of\b/i, (t) => `${t} is the process of`],
      [/^Is\s+defined\s+as\b/i, (t) => `${t} is defined as`],
      [/^Is\s+an?\b/i, (t) => `${t} is an`],
      [/^Means\b/i, (t) => `${t} means`],
      [/^Which\s+[\w\s]+(matches|refers\s+to|describes|is)\s*:?\s*/i, (t) => `${t} describes `],
      [/^What\s+is\s+defined\s+as\b/i, (t) => `${t} is defined as`],
      [/^What\s+is\b/i, (t) => `${t} is`],
    ];

    let statement: string | null = null;
    for (const [regex, replacer] of patterns) {
      if (regex.test(cleanText)) {
        statement = cleanText.replace(regex, replacer(term)).trim();
        break;
      }
    }

    if (!statement) {
      if (/^[A-Z][a-z]+ing\b/.test(cleanText)) {
        const lower = cleanText.charAt(0).toLowerCase() + cleanText.slice(1);
        statement = `${term} involves ${lower}`.trim();
      } else if (/^(is|are|was|were)\b/i.test(cleanText)) {
        statement = `${term} ${cleanText}`.trim();
      } else {
        statement = `${term} is defined as: ${cleanText}`.trim();
      }
    }

    if (statement.endsWith('?')) {
      statement = statement.slice(0, -1) + '.';
    }

    return statement;
  }

  /**
   * Converts a single question into a True/False question.
   * If targetTruth is false, displayTerm is swapped with a distractor from the deck.
   */
  static convertToTrueFalse(
    question: QuizQuestion,
    targetTruth: boolean,
    distractorTerms: string[] = []
  ): QuizQuestion {
    const correctAnswer = getCorrectAnswer(question);
    const correctKey = normalizeForComparison(correctAnswer);

    let displayTerm = correctAnswer;
    let distractorTerm: string | null = null;

    if (!targetTruth) {
      const validDistractors = distractorTerms.filter(
        (term) => normalizeForComparison(term) !== correctKey && term.trim().length > 0
      );

      if (validDistractors.length > 0) {
        distractorTerm = validDistractors[0];
        displayTerm = distractorTerm;
      } else {
        displayTerm = `Non-${correctAnswer}`;
        distractorTerm = displayTerm;
      }
    }

    const statement = QuizTransformService.paraphraseToStatement(question.question_text, displayTerm);

    const explanation = targetTruth
      ? (question.correct_explanation || question.explanation || `True. "${correctAnswer}" is accurately described by this statement.`)
      : (distractorTerm
          ? `False. This statement actually describes "${correctAnswer}", not "${distractorTerm}".`
          : `False. This statement does not describe "${correctAnswer}".`);

    return {
      ...question,
      id: `${question.id}-tf-${targetTruth ? 'true' : 'false'}`,
      question_text: statement,
      options: ['True', 'False'],
      correct_answer: targetTruth ? 0 : 1,
      answer_text: targetTruth ? 'True' : 'False',
      explanation,
      correct_explanation: targetTruth ? (question.correct_explanation || null) : null,
      distractor_explanations: null
    };
  }

  /**
   * Generates True/False questions from a deck of questions using the Term Swap Rule.
   * Alternates or balances between True (accurate term) and False (swapped distractor term from another card).
   */
  static generateTrueFalseQuestions(
    questions: QuizQuestion[],
    options: { truthRatio?: number } = {}
  ): QuizQuestion[] {
    const truthRatio = typeof options.truthRatio === 'number'
      ? Math.max(0, Math.min(1, options.truthRatio))
      : 0.5;

    return questions.map((question, index) => {
      const correctAnswer = getCorrectAnswer(question);
      const correctKey = normalizeForComparison(correctAnswer);

      const targetTruth = truthRatio === 0.5
        ? index % 2 === 0
        : (index / questions.length) < truthRatio;

      const candidateDistractors: string[] = [];

      for (let j = index + 1; j < questions.length; j++) {
        const candidate = getCorrectAnswer(questions[j]);
        if (candidate && normalizeForComparison(candidate) !== correctKey) {
          candidateDistractors.push(candidate);
        }
      }
      for (let j = index - 1; j >= 0; j--) {
        const candidate = getCorrectAnswer(questions[j]);
        if (candidate && normalizeForComparison(candidate) !== correctKey) {
          candidateDistractors.push(candidate);
        }
      }

      if (candidateDistractors.length === 0) {
        for (const opt of question.options) {
          const text = opt.trim();
          const key = normalizeForComparison(text);
          if (text && key !== correctKey && key !== 'true' && key !== 'false') {
            candidateDistractors.push(text);
          }
        }
      }

      return QuizTransformService.convertToTrueFalse(
        question,
        targetTruth,
        candidateDistractors
      );
    });
  }
}

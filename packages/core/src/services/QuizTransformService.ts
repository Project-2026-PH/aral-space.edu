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
}

import { QuizQuestion } from '@quiz-creator/types';

export class QuizTransformService {
  static generateReverseQuestions(questions: QuizQuestion[]): QuizQuestion[] {
    return questions.map((q) => {
      const correctOption = q.options[q.correct_answer];
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

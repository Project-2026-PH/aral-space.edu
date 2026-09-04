import type { IQuizRepository } from '@quiz-creator/core';
import { SAMPLE_QUIZ, SAMPLE_SUBJECT, SAMPLE_QUIZ_ID, SAMPLE_SUBJECT_ID, SAMPLE_QUIZ_QUESTIONS } from '@quiz-creator/core';
import { CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, UpdateShareConfigDto, UpdateSubjectShareConfigDto } from '@quiz-creator/types';

export class QuizCrudController {
  constructor(private quizRepo: IQuizRepository) {}

  async listQuizzes(userId?: string) {
    const list = await this.quizRepo.listQuizzes(userId);
    if (!list.some(q => q.id === SAMPLE_QUIZ_ID)) {
      return [SAMPLE_QUIZ, ...list];
    }
    return list;
  }

  async listSubjects(userId?: string) {
    const list = await this.quizRepo.listSubjects(userId);
    if (!list.some(s => s.id === SAMPLE_SUBJECT_ID)) {
      return [SAMPLE_SUBJECT, ...list];
    }
    return list;
  }

  async listQuizzesAndSubjects(userId?: string) {
    let result: { quizzes: any[]; subjects: any[] };
    if (this.quizRepo.listQuizzesAndSubjects) {
      result = await this.quizRepo.listQuizzesAndSubjects(userId);
    } else {
      const [quizzes, subjects] = await Promise.all([
        this.quizRepo.listQuizzes(userId),
        this.quizRepo.listSubjects(userId),
      ]);
      result = { quizzes, subjects };
    }
    const quizzes = result.quizzes.some(q => q.id === SAMPLE_QUIZ_ID)
      ? result.quizzes
      : [SAMPLE_QUIZ, ...result.quizzes];
    const subjects = result.subjects.some(s => s.id === SAMPLE_SUBJECT_ID)
      ? result.subjects
      : [SAMPLE_SUBJECT, ...result.subjects];
    return { quizzes, subjects };
  }

  async createSubject(name: string, color: string, userId?: string) {
    return await this.quizRepo.createSubject(name, color, userId);
  }

  async getSubjectShareConfig(subjectId: string, userId?: string) {
    return await this.quizRepo.getSubjectShareConfig(subjectId, userId);
  }

  async updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string) {
    return await this.quizRepo.updateSubjectShareConfig(subjectId, dto, userId);
  }

  async getSubjectByShareToken(shareToken: string) {
    if (shareToken === SAMPLE_SUBJECT.share_token) {
      const found = await this.quizRepo.getSubjectByShareToken(shareToken);
      return found || SAMPLE_SUBJECT;
    }
    return await this.quizRepo.getSubjectByShareToken(shareToken);
  }

  async getQuiz(id: string, userId?: string) {
    if (id === SAMPLE_QUIZ_ID) {
      return {
        ...SAMPLE_QUIZ,
        questions: SAMPLE_QUIZ_QUESTIONS
      };
    }
    const quiz = await this.quizRepo.getQuizById(id, userId);
    if (!quiz) return null;
    const questions = await this.quizRepo.getQuestionsByQuizId(id);
    return { ...quiz, questions };
  }

  async createQuiz(dto: CreateQuizDto, userId?: string) {
    return await this.quizRepo.createQuiz(dto, userId);
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string) {
    return await this.quizRepo.updateQuiz(id, dto, userId);
  }

  async deleteQuiz(id: string, userId?: string) {
    return await this.quizRepo.deleteQuiz(id, userId);
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto) {
    return await this.quizRepo.addQuestion(quizId, dto);
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto) {
    return await this.quizRepo.updateQuestion(questionId, dto);
  }

  async deleteQuestion(questionId: string) {
    return await this.quizRepo.deleteQuestion(questionId);
  }

  async reorderQuestions(quizId: string, questionIds: string[]) {
    return await this.quizRepo.reorderQuestions(quizId, questionIds);
  }

  async getShareConfig(quizId: string, userId?: string) {
    return await this.quizRepo.getShareConfig(quizId, userId);
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string) {
    return await this.quizRepo.updateShareConfig(quizId, dto, userId);
  }

  async getQuizByShareToken(shareToken: string) {
    return await this.quizRepo.getQuizByShareToken(shareToken);
  }

  async cloneQuizByShareToken(shareToken: string, userId?: string) {
    return await this.quizRepo.cloneQuizByShareToken(shareToken, userId);
  }
}

import { IQuizRepository } from '@quiz-creator/core';
import { CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto } from '@quiz-creator/types';

export class QuizCrudController {
  constructor(private quizRepo: IQuizRepository) {}

  async listQuizzes(userId?: string) {
    return await this.quizRepo.listQuizzes(userId);
  }

  async listSubjects(userId?: string) {
    return await this.quizRepo.listSubjects(userId);
  }

  async createSubject(name: string, color: string, userId?: string) {
    return await this.quizRepo.createSubject(name, color, userId);
  }

  async getQuiz(id: string, userId?: string) {
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
}

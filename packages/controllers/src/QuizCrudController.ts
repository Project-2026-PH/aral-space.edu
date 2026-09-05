import type { IQuizRepository } from '@quiz-creator/core/repositories';
import { SAMPLE_QUIZ, SAMPLE_SUBJECT, SAMPLE_QUIZ_ID, SAMPLE_SUBJECT_ID, SAMPLE_QUIZ_QUESTIONS } from '@quiz-creator/core/services';
import { CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, UpdateShareConfigDto, UpdateSubjectShareConfigDto, UpdateSubjectDto } from '@quiz-creator/types';

export class QuizCrudController {
  constructor(private quizRepo: IQuizRepository) {}

  async listQuizzes(userId?: string) {
    const list = await this.quizRepo.listQuizzes(userId);
    return list.some(q => q.id === SAMPLE_QUIZ_ID) ? list : [SAMPLE_QUIZ, ...list];
  }

  async listSubjects(userId?: string) {
    const list = await this.quizRepo.listSubjects(userId);
    return list.some(s => s.id === SAMPLE_SUBJECT_ID) ? list : [SAMPLE_SUBJECT, ...list];
  }

  async listQuizzesAndSubjects(userId?: string) {
    const result = this.quizRepo.listQuizzesAndSubjects
      ? await this.quizRepo.listQuizzesAndSubjects(userId)
      : await Promise.all([this.quizRepo.listQuizzes(userId), this.quizRepo.listSubjects(userId)]).then(([quizzes, subjects]) => ({ quizzes, subjects }));
    return {
      quizzes: result.quizzes.some(q => q.id === SAMPLE_QUIZ_ID) ? result.quizzes : [SAMPLE_QUIZ, ...result.quizzes],
      subjects: result.subjects.some(s => s.id === SAMPLE_SUBJECT_ID) ? result.subjects : [SAMPLE_SUBJECT, ...result.subjects]
    };
  }

  async createSubject(name: string, color: string, userId?: string) { return this.quizRepo.createSubject(name, color, userId); }
  async updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string) { return this.quizRepo.updateSubject(subjectId, dto, userId); }
  async deleteSubject(subjectId: string, userId?: string) { return this.quizRepo.deleteSubject(subjectId, userId); }
  async getSubjectAccess(subjectId: string, userId?: string) { return this.quizRepo.getSubjectAccess(subjectId, userId); }
  async listQuizzesBySubject(subjectId: string, userId?: string) { return this.quizRepo.listQuizzesBySubject(subjectId, userId); }
  async createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string) { return this.quizRepo.createSubjectCollaboratorLink(subjectId, expiresAt, userId); }
  async redeemSubjectCollaboratorLink(token: string, userId: string) { return this.quizRepo.redeemSubjectCollaboratorLink(token, userId); }
  async getSubjectShareConfig(subjectId: string, userId?: string) { return this.quizRepo.getSubjectShareConfig(subjectId, userId); }
  async updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string) { return this.quizRepo.updateSubjectShareConfig(subjectId, dto, userId); }

  async getSubjectByShareToken(shareToken: string) {
    if (shareToken === SAMPLE_SUBJECT.share_token) {
      return (await this.quizRepo.getSubjectByShareToken(shareToken)) || { ...SAMPLE_SUBJECT, quizzes: [] };
    }
    return this.quizRepo.getSubjectByShareToken(shareToken);
  }

  async getQuiz(id: string, userId?: string) {
    if (id === SAMPLE_QUIZ_ID) return { ...SAMPLE_QUIZ, questions: SAMPLE_QUIZ_QUESTIONS };
    const [quiz, questions] = await Promise.all([
      this.quizRepo.getQuizById(id, userId),
      this.quizRepo.getQuestionsByQuizId(id, userId)
    ]);
    if (!quiz) return null;
    return { ...quiz, questions };
  }

  async createQuiz(dto: CreateQuizDto, userId?: string) { return this.quizRepo.createQuiz(dto, userId); }
  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string) { return this.quizRepo.updateQuiz(id, dto, userId); }
  async deleteQuiz(id: string, userId?: string) { return this.quizRepo.deleteQuiz(id, userId); }
  async addQuestion(quizId: string, dto: CreateQuestionDto, userId?: string) { return this.quizRepo.addQuestion(quizId, dto, userId); }
  async updateQuestion(quizId: string, questionId: string, dto: UpdateQuestionDto, userId?: string) { return this.quizRepo.updateQuestion(quizId, questionId, dto, userId); }
  async deleteQuestion(quizId: string, questionId: string, userId?: string) { return this.quizRepo.deleteQuestion(quizId, questionId, userId); }
  async reorderQuestions(quizId: string, questionIds: string[], userId?: string) { return this.quizRepo.reorderQuestions(quizId, questionIds, userId); }
  async getShareConfig(quizId: string, userId?: string) { return this.quizRepo.getShareConfig(quizId, userId); }
  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string) { return this.quizRepo.updateShareConfig(quizId, dto, userId); }
  async getQuizByShareToken(shareToken: string) { return this.quizRepo.getQuizByShareToken(shareToken); }
  async cloneQuizByShareToken(shareToken: string, userId?: string) { return this.quizRepo.cloneQuizByShareToken(shareToken, userId); }
}

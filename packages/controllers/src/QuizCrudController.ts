import type { IQuizRepository } from '@quiz-creator/core/repositories';
import { CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, UpdateShareConfigDto, UpdateSubjectShareConfigDto, UpdateSubjectDto, LibraryData } from '@quiz-creator/types';

export class QuizCrudController {
  constructor(private quizRepo: IQuizRepository) {}

  async listQuizzes(userId?: string) {
    return this.quizRepo.listQuizzes(userId);
  }

  async listSubjects(userId?: string) {
    return this.quizRepo.listSubjects(userId);
  }

  async listQuizzesAndSubjects(userId?: string): Promise<LibraryData> {
    if (this.quizRepo.listQuizzesAndSubjects) {
      return this.quizRepo.listQuizzesAndSubjects(userId);
    }
    const [quizzes, subjects] = await Promise.all([
      this.quizRepo.listQuizzes(userId),
      this.quizRepo.listSubjects(userId)
    ]);
    const sharedSubjects = userId
      ? subjects.filter((subject) => Boolean(subject.user_id && subject.user_id !== userId))
      : [];
    const sharedSubjectIds = new Set(sharedSubjects.map((subject) => subject.id));
    const ownedSubjects = subjects.filter((subject) => !sharedSubjectIds.has(subject.id));
    const subjectsWithCounts = await Promise.all(ownedSubjects.map(async (subject) => ({
      ...subject,
      viewer_count: userId && this.quizRepo.getSubjectViewerCount
        ? await this.quizRepo.getSubjectViewerCount(subject.id, userId)
        : subject.viewer_count || 0
    })));
    return {
      quizzes: quizzes.filter((quiz) => !quiz.subject_id || !sharedSubjectIds.has(quiz.subject_id)),
      subjects: subjectsWithCounts,
      sharedQuizzes: quizzes.filter((quiz) => Boolean(quiz.subject_id && sharedSubjectIds.has(quiz.subject_id))),
      sharedSubjects
    };
  }

  async recordSubjectView(subjectId: string, viewerId: string) {
    if (!this.quizRepo.recordSubjectView) return;
    return this.quizRepo.recordSubjectView(subjectId, viewerId);
  }

  async getSubjectViewerCount(subjectId: string, ownerId: string) {
    if (!this.quizRepo.getSubjectViewerCount) return 0;
    return this.quizRepo.getSubjectViewerCount(subjectId, ownerId);
  }

  async createSubject(name: string, color: string, userId?: string) { return this.quizRepo.createSubject(name, color, userId); }
  async updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string) { return this.quizRepo.updateSubject(subjectId, dto, userId); }
  async deleteSubject(subjectId: string, userId?: string) { return this.quizRepo.deleteSubject(subjectId, userId); }
  async getSubjectAccess(subjectId: string, userId?: string) { return this.quizRepo.getSubjectAccess(subjectId, userId); }
  async listQuizzesBySubject(subjectId: string, userId?: string) { return this.quizRepo.listQuizzesBySubject(subjectId, userId); }
  async createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string, maxUses?: number) { return this.quizRepo.createSubjectCollaboratorLink(subjectId, expiresAt, userId, maxUses); }
  async redeemSubjectCollaboratorLink(token: string, userId: string) { return this.quizRepo.redeemSubjectCollaboratorLink(token, userId); }
  async getSubjectShareConfig(subjectId: string, userId?: string) { return this.quizRepo.getSubjectShareConfig(subjectId, userId); }
  async updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string) { return this.quizRepo.updateSubjectShareConfig(subjectId, dto, userId); }

  async getSubjectByShareToken(shareToken: string) {
    return this.quizRepo.getSubjectByShareToken(shareToken);
  }

  async getQuiz(id: string, userId?: string) {
    const quiz = await this.quizRepo.getQuizById(id, userId);
    if (!quiz) return null;

    const questions = await this.quizRepo.getQuestionsByQuizId(id, userId);
    return { ...quiz, questions };
  }

  async getQuizById(id: string, userId?: string) {
    return this.quizRepo.getQuizById(id, userId);
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

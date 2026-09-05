import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto, UpdateSubjectDto, SubjectAccess, SubjectCollaboratorLink } from '@quiz-creator/types';
import { LRUCache } from '../cache/LRUCache';

export class CachedQuizRepository implements IQuizRepository {
  private cache: LRUCache<string, any>;

  constructor(
    private underlying: IQuizRepository,
    cacheInstance?: LRUCache<string, any>
  ) {
    this.cache = cacheInstance ?? new LRUCache<string, any>({ maxSize: 1000, ttlMs: 60_000 });
  }

  private subjectKey(userId?: string): string {
    return `subjects:${userId || 'anon'}`;
  }

  private quizzesKey(userId?: string): string {
    return `quizzes:${userId || 'anon'}`;
  }

  private quizKey(id: string, userId?: string): string {
    return `quiz:${id}:${userId || 'anon'}`;
  }

  private questionsKey(quizId: string): string {
    return `questions:${quizId}`;
  }

  async listSubjects(userId?: string): Promise<Subject[]> {
    const key = this.subjectKey(userId);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const subjects = await this.underlying.listSubjects(userId);
    this.cache.set(key, subjects);
    return subjects;
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    const subject = await this.underlying.createSubject(name, color, userId);
    this.cache.deleteByPrefix('subjects:');
    return subject;
  }

  async updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string): Promise<Subject> {
    const subject = await this.underlying.updateSubject(subjectId, dto, userId);
    this.cache.deleteByPrefix('subjects:');
    this.cache.deleteByPrefix('quizzes:');
    return subject;
  }

  async deleteSubject(subjectId: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.deleteSubject(subjectId, userId);
    this.cache.deleteByPrefix('subjects:');
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix(`quiz:`);
    this.cache.deleteByPrefix('questions:');
    return result;
  }

  async getSubjectAccess(subjectId: string, userId?: string): Promise<SubjectAccess | null> {
    return this.underlying.getSubjectAccess(subjectId, userId);
  }

  async listQuizzesBySubject(subjectId: string, userId?: string): Promise<Quiz[]> {
    return this.underlying.listQuizzesBySubject(subjectId, userId);
  }

  async createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string): Promise<SubjectCollaboratorLink> {
    return this.underlying.createSubjectCollaboratorLink(subjectId, expiresAt, userId);
  }

  async redeemSubjectCollaboratorLink(token: string, userId: string): Promise<SubjectAccess | null> {
    const access = await this.underlying.redeemSubjectCollaboratorLink(token, userId);
    this.cache.deleteByPrefix('subjects:');
    this.cache.deleteByPrefix('quizzes:');
    return access;
  }

  async getSubjectShareConfig(subjectId: string, userId?: string) {
    return this.underlying.getSubjectShareConfig(subjectId, userId);
  }

  async updateSubjectShareConfig(
    subjectId: string,
    dto: { is_public?: boolean; reset_token?: boolean },
    userId?: string
  ) {
    const config = await this.underlying.updateSubjectShareConfig(subjectId, dto, userId);
    this.cache.deleteByPrefix('subjects:');
    return config;
  }

  async getSubjectByShareToken(shareToken: string) {
    return this.underlying.getSubjectByShareToken(shareToken);
  }

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    const key = this.quizzesKey(userId);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const quizzes = await this.underlying.listQuizzes(userId);
    this.cache.set(key, quizzes);
    return quizzes;
  }

  async listQuizzesAndSubjects(userId?: string): Promise<{ quizzes: Quiz[]; subjects: Subject[] }> {
    const qKey = this.quizzesKey(userId);
    const sKey = this.subjectKey(userId);
    const cachedQuizzes = this.cache.get(qKey);
    const cachedSubjects = this.cache.get(sKey);

    if (cachedQuizzes !== undefined && cachedSubjects !== undefined) {
      return { quizzes: cachedQuizzes, subjects: cachedSubjects };
    }

    if (this.underlying.listQuizzesAndSubjects) {
      const data = await this.underlying.listQuizzesAndSubjects(userId);
      this.cache.set(qKey, data.quizzes);
      this.cache.set(sKey, data.subjects);
      return data;
    }

    const [quizzes, subjects] = await Promise.all([
      this.listQuizzes(userId),
      this.listSubjects(userId),
    ]);
    return { quizzes, subjects };
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    const key = this.quizKey(id, userId);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const quiz = await this.underlying.getQuizById(id, userId);
    if (quiz) {
      this.cache.set(key, quiz);
    }
    return quiz;
  }

  async createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz> {
    const created = await this.underlying.createQuiz(dto, userId);
    this.cache.delete(this.quizzesKey(userId));
    this.cache.delete(this.quizKey(created.id, userId));
    return created;
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    const updated = await this.underlying.updateQuiz(id, dto, userId);
    this.cache.delete(this.quizzesKey(userId));
    this.cache.delete(this.quizKey(id, userId));
    return updated;
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.deleteQuiz(id, userId);
    this.cache.delete(this.quizzesKey(userId));
    this.cache.delete(this.quizKey(id, userId));
    this.cache.delete(this.questionsKey(id));
    return result;
  }

  async getQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    const key = this.questionsKey(quizId);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const questions = await this.underlying.getQuestionsByQuizId(quizId);
    this.cache.set(key, questions);
    return questions;
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto): Promise<QuizQuestion> {
    const question = await this.underlying.addQuestion(quizId, dto);
    this.cache.delete(this.questionsKey(quizId));
    this.cache.deleteByPrefix(`quiz:${quizId}`);
    this.cache.deleteByPrefix('quizzes:');
    return question;
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto): Promise<QuizQuestion> {
    const question = await this.underlying.updateQuestion(questionId, dto);
    // Invalidate questions cache across quizzes (or target quiz if known)
    this.cache.deleteByPrefix('questions:');
    return question;
  }

  async deleteQuestion(questionId: string): Promise<boolean> {
    const result = await this.underlying.deleteQuestion(questionId);
    this.cache.deleteByPrefix('questions:');
    this.cache.deleteByPrefix('quiz:');
    this.cache.deleteByPrefix('quizzes:');
    return result;
  }

  async reorderQuestions(quizId: string, questionIds: string[]): Promise<boolean> {
    const result = await this.underlying.reorderQuestions(quizId, questionIds);
    this.cache.delete(this.questionsKey(quizId));
    return result;
  }

  async getShareConfig(quizId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    return this.underlying.getShareConfig(quizId, userId);
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    const res = await this.underlying.updateShareConfig(quizId, dto, userId);
    this.cache.delete(this.quizKey(quizId, userId));
    return res;
  }

  async getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null> {
    return this.underlying.getQuizByShareToken(shareToken);
  }

  async cloneQuizByShareToken(shareToken: string, userId?: string): Promise<Quiz> {
    const res = await this.underlying.cloneQuizByShareToken(shareToken, userId);
    this.cache.delete(this.quizzesKey(userId));
    return res;
  }

  /**
   * Directly clear internal cache (useful for test isolation or forced invalidation)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

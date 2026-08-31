import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject } from '@quiz-creator/types';
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

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    const key = this.quizzesKey(userId);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const quizzes = await this.underlying.listQuizzes(userId);
    this.cache.set(key, quizzes);
    return quizzes;
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

  /**
   * Directly clear internal cache (useful for test isolation or forced invalidation)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, UpdateSubjectShareConfigDto, PublicQuizDto, UpdateSubjectDto, SubjectAccess, SubjectCollaboratorLink, LibraryData } from '@quiz-creator/types';
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

  private questionsKey(quizId: string, userId?: string): string {
    return `questions:${quizId}:${userId || 'anon'}`;
  }

  private libraryKey(userId?: string): string {
    return `library:${userId || 'anon'}`;
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
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('public_subject:');
    return subject;
  }

  async recordSubjectView(subjectId: string, viewerId: string): Promise<void> {
    if (!this.underlying.recordSubjectView) return;
    await this.underlying.recordSubjectView(subjectId, viewerId);
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('subjects:');
  }

  async getSubjectViewerCount(subjectId: string, ownerId: string): Promise<number> {
    if (!this.underlying.getSubjectViewerCount) return 0;
    return this.underlying.getSubjectViewerCount(subjectId, ownerId);
  }

  async updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string): Promise<Subject> {
    const subject = await this.underlying.updateSubject(subjectId, dto, userId);
    this.cache.deleteByPrefix('subjects:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('public_subject:');
    this.cache.deleteByPrefix('public_quiz:');
    return subject;
  }

  async deleteSubject(subjectId: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.deleteSubject(subjectId, userId);
    this.cache.deleteByPrefix('subjects:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix(`quiz:`);
    this.cache.deleteByPrefix('questions:');
    return result;
  }

  async archiveSubject(subjectId: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.archiveSubject(subjectId, userId);
    this.cache.deleteByPrefix('subjects:');
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('quiz:');
    this.cache.deleteByPrefix('questions:');
    this.cache.deleteByPrefix('public_subject:');
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('archived_subjects:');
    this.cache.deleteByPrefix('archived_quizzes:');
    return result;
  }

  async restoreSubject(subjectId: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.restoreSubject(subjectId, userId);
    this.cache.deleteByPrefix('subjects:');
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('quiz:');
    this.cache.deleteByPrefix('questions:');
    this.cache.deleteByPrefix('public_subject:');
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('archived_subjects:');
    this.cache.deleteByPrefix('archived_quizzes:');
    return result;
  }

  async listArchivedSubjects(userId: string): Promise<Subject[]> {
    const key = `archived_subjects:${userId}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const subjects = await this.underlying.listArchivedSubjects(userId);
    this.cache.set(key, subjects);
    return subjects;
  }

  async getSubjectAccess(subjectId: string, userId?: string): Promise<SubjectAccess | null> {
    return this.underlying.getSubjectAccess(subjectId, userId);
  }

  async listQuizzesBySubject(subjectId: string, userId?: string): Promise<Quiz[]> {
    return this.underlying.listQuizzesBySubject(subjectId, userId);
  }

  async createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string, maxUses?: number): Promise<SubjectCollaboratorLink> {
    return this.underlying.createSubjectCollaboratorLink(subjectId, expiresAt, userId, maxUses);
  }

  async redeemSubjectCollaboratorLink(token: string, userId: string): Promise<SubjectAccess | null> {
    const access = await this.underlying.redeemSubjectCollaboratorLink(token, userId);
    this.cache.deleteByPrefix('subjects:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
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
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('public_subject:');
    return config;
  }

  async getSubjectByShareToken(shareToken: string) {
    const key = `public_subject:${shareToken}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const subject = await this.underlying.getSubjectByShareToken(shareToken);
    if (subject) {
      this.cache.set(key, subject);
    }
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

  async listQuizzesAndSubjects(userId?: string): Promise<LibraryData> {
    const key = this.libraryKey(userId);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const data = this.underlying.listQuizzesAndSubjects
      ? await this.underlying.listQuizzesAndSubjects(userId)
      : {
          quizzes: await this.underlying.listQuizzes(userId),
          subjects: await this.underlying.listSubjects(userId)
        };
    const sourceSubjects = data.subjects || [];
    const sourceQuizzes = data.quizzes || [];
    const sharedSubjects = data.sharedSubjects || (userId
      ? sourceSubjects.filter((subject) => Boolean(subject.user_id && subject.user_id !== userId))
      : []);
    const sharedSubjectIds = new Set(sharedSubjects.map((subject) => subject.id));
    const sharedQuizzes = data.sharedQuizzes || sourceQuizzes.filter((quiz) => {
      if (quiz.subject_id) return sharedSubjectIds.has(quiz.subject_id);
      return quiz.is_public === true && quiz.user_id !== userId && quiz.user_id !== undefined;
    });
    const result: LibraryData = {
      quizzes: sourceQuizzes.filter((quiz) => !sharedQuizzes.includes(quiz)),
      subjects: sourceSubjects.filter((subject) => !sharedSubjectIds.has(subject.id)),
      sharedQuizzes,
      sharedSubjects
    };
    this.cache.set(key, result);
    return result;
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
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.delete(this.quizKey(created.id, userId));
    this.cache.deleteByPrefix('public_subject:');
    return created;
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    const updated = await this.underlying.updateQuiz(id, dto, userId);
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.delete(this.quizKey(id, userId));
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    return updated;
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.deleteQuiz(id, userId);
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.delete(this.quizKey(id, userId));
    this.cache.deleteByPrefix(`questions:${id}:`);
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    return result;
  }

  async archiveQuiz(id: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.archiveQuiz(id, userId);
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix(`quiz:${id}`);
    this.cache.deleteByPrefix(`questions:${id}:`);
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    this.cache.deleteByPrefix('archived_quizzes:');
    return result;
  }

  async restoreQuiz(id: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.restoreQuiz(id, userId);
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix(`quiz:${id}`);
    this.cache.deleteByPrefix(`questions:${id}:`);
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    this.cache.deleteByPrefix('archived_quizzes:');
    return result;
  }

  async listArchivedQuizzes(userId: string): Promise<Quiz[]> {
    const key = `archived_quizzes:${userId}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const quizzes = await this.underlying.listArchivedQuizzes(userId);
    this.cache.set(key, quizzes);
    return quizzes;
  }

  async purgeUserData(userId: string): Promise<void> {
    if (!this.underlying.purgeUserData) {
      throw new Error('Underlying quiz repository does not support guest data deletion');
    }
    await this.underlying.purgeUserData(userId);
    this.cache.clear();
  }

  async getQuestionsByQuizId(quizId: string, userId?: string): Promise<QuizQuestion[]> {
    const key = this.questionsKey(quizId, userId);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const questions = await this.underlying.getQuestionsByQuizId(quizId, userId);
    this.cache.set(key, questions);
    return questions;
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto, userId?: string): Promise<QuizQuestion> {
    const question = await this.underlying.addQuestion(quizId, dto, userId);
    this.cache.deleteByPrefix(`questions:${quizId}:`);
    this.cache.deleteByPrefix(`quiz:${quizId}`);
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    return question;
  }

  async updateQuestion(quizId: string, questionId: string, dto: UpdateQuestionDto, userId?: string): Promise<QuizQuestion> {
    const question = await this.underlying.updateQuestion(quizId, questionId, dto, userId);
    this.cache.deleteByPrefix(`questions:${quizId}:`);
    this.cache.deleteByPrefix(`quiz:${quizId}`);
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    return question;
  }

  async deleteQuestion(quizId: string, questionId: string, userId?: string): Promise<boolean> {
    const result = await this.underlying.deleteQuestion(quizId, questionId, userId);
    this.cache.deleteByPrefix(`questions:${quizId}:`);
    this.cache.deleteByPrefix(`quiz:${quizId}`);
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    return result;
  }

  async reorderQuestions(quizId: string, questionIds: string[], userId?: string): Promise<boolean> {
    const result = await this.underlying.reorderQuestions(quizId, questionIds, userId);
    this.cache.deleteByPrefix(`questions:${quizId}:`);
    this.cache.deleteByPrefix(`quiz:${quizId}`);
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    return result;
  }

  async getShareConfig(quizId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    return this.underlying.getShareConfig(quizId, userId);
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    const res = await this.underlying.updateShareConfig(quizId, dto, userId);
    this.cache.delete(this.quizKey(quizId, userId));
    this.cache.deleteByPrefix('quizzes:');
    this.cache.deleteByPrefix('library:');
    this.cache.deleteByPrefix('public_quiz:');
    this.cache.deleteByPrefix('public_subject:');
    return res;
  }

  async getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null> {
    const key = `public_quiz:${shareToken}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const quiz = await this.underlying.getQuizByShareToken(shareToken);
    if (quiz) {
      this.cache.set(key, quiz);
    }
    return quiz;
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

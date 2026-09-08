import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, UpdateSubjectShareConfigDto, PublicQuizDto, UpdateSubjectDto, SubjectAccess, SubjectCollaboratorLink } from '@quiz-creator/types';
import { normalizeQuestionFields } from './questionFields';
import { SAMPLE_SUBJECT, SAMPLE_QUIZ, SAMPLE_QUIZ_QUESTIONS, SAMPLE_QUIZ_ID } from '../services/SampleQuizService';
import { generateSecureToken, isShareTokenActive } from '../security/shareTokens';
import { toPublicQuizDto, toPublicSubjectDto } from '../security/publicDtos';

function generateShareToken(): string {
  return generateSecureToken(32);
}

const STORAGE_KEY_QUIZZES = 'quiz_creator_quizzes_v1';
const STORAGE_KEY_QUESTIONS = 'quiz_creator_questions_v1';
const STORAGE_KEY_SUBJECTS = 'quiz_creator_subjects_v1';

export class LocalFirstQuizRepository implements IQuizRepository {
  private inMemorySubjects: Map<string, Subject> = new Map();
  private inMemoryQuizzes: Map<string, Quiz> = new Map();
  private inMemoryQuestions: Map<string, QuizQuestion> = new Map();
  private collaboratorLinks: Map<string, { subject_id: string; expires_at: string | null; used_at: string | null; user_id: string | null; max_uses: number; uses_count: number; redeemed_by: string[] }> = new Map();
  private collaborators: Map<string, Set<string>> = new Map();
  private subjectViews: Map<string, Set<string>> = new Map();

  constructor() {
    this.hydrateFromStorage();
    this.seedDefaultDataIfEmpty();
  }

  private seedDefaultDataIfEmpty(): void {
    if (!this.inMemoryQuizzes.has(SAMPLE_QUIZ_ID)) {
      this.inMemorySubjects.set(SAMPLE_SUBJECT.id, SAMPLE_SUBJECT);
      this.inMemoryQuizzes.set(SAMPLE_QUIZ.id, SAMPLE_QUIZ);
      SAMPLE_QUIZ_QUESTIONS.forEach(q => {
        this.inMemoryQuestions.set(q.id, q);
      });
    }
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private hydrateFromStorage(): void {
    if (!this.isBrowser()) return;

    try {
      const storedSubjects = localStorage.getItem(STORAGE_KEY_SUBJECTS);
      if (storedSubjects) {
        const parsed: Subject[] = JSON.parse(storedSubjects);
        parsed.forEach(s => this.inMemorySubjects.set(s.id, s));
      }

      const storedQuizzes = localStorage.getItem(STORAGE_KEY_QUIZZES);
      if (storedQuizzes) {
        const parsed: Quiz[] = JSON.parse(storedQuizzes);
        parsed.forEach(q => this.inMemoryQuizzes.set(q.id, q));
      }

      const storedQuestions = localStorage.getItem(STORAGE_KEY_QUESTIONS);
      if (storedQuestions) {
        const parsed: QuizQuestion[] = JSON.parse(storedQuestions);
        parsed.forEach(q => this.inMemoryQuestions.set(q.id, q));
      }

      // Collaborator invitations are bearer secrets and are intentionally not hydrated from localStorage.
      localStorage.removeItem('quiz_creator_collaborator_links_v1');
      localStorage.removeItem('quiz_creator_collaborators_v1');
    } catch (e) {
      console.warn('[LocalFirstQuizRepository] Failed to hydrate from storage:', e);
    }
  }

  private persistToStorage(): void {
    if (!this.isBrowser()) return;

    try {
      localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(Array.from(this.inMemorySubjects.values())));
      localStorage.setItem(STORAGE_KEY_QUIZZES, JSON.stringify(Array.from(this.inMemoryQuizzes.values())));
      localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(Array.from(this.inMemoryQuestions.values())));
      // Do not persist collaborator invitation tokens or memberships in browser storage.
    } catch (e) {
      console.warn('[LocalFirstQuizRepository] Failed to persist to storage:', e);
    }
  }

  private async requireSubjectAssignment(subjectId: string | null | undefined, userId?: string): Promise<void> {
    if (!subjectId) return;
    if (!this.inMemorySubjects.has(subjectId)) throw new Error('Subject not found or access is restricted');
    if (userId && !(await this.getSubjectAccess(subjectId, userId))?.can_edit_reviewers) {
      throw new Error('Subject not found or access is restricted');
    }
  }

  private async requireQuizAccess(quizId: string, userId?: string): Promise<Quiz> {
    const quiz = await this.getQuizById(quizId, userId);
    if (!quiz) throw new Error('Quiz not found or access is restricted');
    return quiz;
  }

  private async requireQuizWriteAccess(quizId: string, userId?: string): Promise<Quiz> {
    if (!userId) throw new Error('Authenticated user required for quiz writes');
    const quiz = await this.requireQuizAccess(quizId, userId);
    if (quiz.user_id !== userId) {
      const access = quiz.subject_id ? await this.getSubjectAccess(quiz.subject_id, userId) : null;
      if (!access?.can_edit_reviewers) throw new Error('Reviewer is read-only for this user');
    }
    return quiz;
  }

  private async requireQuizOwnerAccess(quizId: string, userId?: string): Promise<Quiz> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    const quiz = await this.requireQuizAccess(quizId, userId);
    if (quiz.user_id !== userId) throw new Error('Only the reviewer owner can manage this reviewer');
    return quiz;
  }

  async listSubjects(userId?: string): Promise<Subject[]> {
    const list = Array.from(this.inMemorySubjects.values());
    return list.filter((subject) => {
      if (userId && (subject.user_id === userId || this.collaborators.get(subject.id)?.has(userId))) return true;
      return isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at);
    });
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const subject: Subject = {
      id,
      name,
      color,
      user_id: userId,
      share_token: generateShareToken(),
      is_public: true,
      created_at: new Date().toISOString()
    };
    this.inMemorySubjects.set(id, subject);
    this.persistToStorage();
    return subject;
  }

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    const all = Array.from(this.inMemoryQuizzes.values());
    const filtered = all.filter((quiz) => {
      if (userId && (quiz.user_id === userId || Boolean(quiz.subject_id && this.collaborators.get(quiz.subject_id)?.has(userId)))) return true;
      return isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at);
    });
    return filtered.map((quiz) => ({
      ...quiz,
      subject: quiz.subject_id ? this.inMemorySubjects.get(quiz.subject_id) || null : null
    }));
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    const quiz = this.inMemoryQuizzes.get(id);
    if (!quiz) return null;
    const isOwner = Boolean(userId && quiz.user_id === userId);
    const isCollaborator = Boolean(userId && quiz.subject_id && this.collaborators.get(quiz.subject_id)?.has(userId));
    if (!isOwner && !isCollaborator && !isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at)) return null;
    return {
      ...quiz,
      subject: quiz.subject_id ? this.inMemorySubjects.get(quiz.subject_id) || null : null
    };
  }

  async createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz> {
    await this.requireSubjectAssignment(dto.subject_id, userId);
    const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newQuiz: Quiz = {
      id: quizId,
      title: dto.title,
      description: dto.description || null,
      term: dto.term || null,
      question_count: dto.questions.length,
      generated_at: new Date().toISOString(),
      handout_name: dto.handout_name || null,
      source_model: dto.source_model || 'manual',
      subject_id: dto.subject_id || null,
      user_id: userId || null,
      share_token: generateShareToken(),
      is_public: true,
      allow_cloning: true,
      created_at: new Date().toISOString()
    };
    this.inMemoryQuizzes.set(quizId, newQuiz);

    dto.questions.forEach((q, idx) => {
      const qId = `q-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
      const fields = normalizeQuestionFields(q);
      this.inMemoryQuestions.set(qId, {
        id: qId,
        quiz_id: quizId,
        question_text: q.question_text,
        answer_text: fields.answer_text,
        question_type: fields.question_type,
        options: fields.options,
        correct_answer: fields.correct_answer,
        explanation: q.explanation || null,
        correct_explanation: fields.correct_explanation || null,
        distractor_explanations: fields.distractor_explanations || null,
        discriminatory_keywords: fields.discriminatory_keywords || null,
        source_pages: q.source_pages || [],
        order_index: idx,
        created_at: new Date().toISOString()
      });
    });

    this.persistToStorage();
    return newQuiz;
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    const quiz = await this.requireQuizWriteAccess(id, userId);
    if (dto.subject_id !== undefined) {
      if (userId && quiz.user_id !== userId) {
        throw new Error('Only the reviewer owner can change subject assignment');
      }
      await this.requireSubjectAssignment(dto.subject_id, userId);
    }
    if (dto.title !== undefined) quiz.title = dto.title;
    if (dto.description !== undefined) quiz.description = dto.description;
    if (dto.term !== undefined) quiz.term = dto.term;
    if (dto.subject_id !== undefined) quiz.subject_id = dto.subject_id;
    this.inMemoryQuizzes.set(id, quiz);
    this.persistToStorage();
    return quiz;
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for quiz management');
    const quiz = await this.getQuizById(id, userId);
    if (!quiz || quiz.user_id !== userId) return false;
    const deleted = this.inMemoryQuizzes.delete(quiz.id);
    for (const [qId, q] of this.inMemoryQuestions.entries()) {
      if (q.quiz_id === id) this.inMemoryQuestions.delete(qId);
    }
    this.persistToStorage();
    return deleted;
  }

  async getQuestionsByQuizId(quizId: string, userId?: string): Promise<QuizQuestion[]> {
    await this.requireQuizAccess(quizId, userId);
    const list: QuizQuestion[] = [];
    for (const q of this.inMemoryQuestions.values()) {
      if (q.quiz_id === quizId) list.push(q);
    }
    return list.sort((a, b) => a.order_index - b.order_index);
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto, userId?: string): Promise<QuizQuestion> {
    const quiz = await this.requireQuizWriteAccess(quizId, userId);
    const questions = await this.getQuestionsByQuizId(quizId, userId);
    const orderIndex = dto.order_index !== undefined ? dto.order_index : questions.length;
    const qId = `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const fields = normalizeQuestionFields(dto);

    const newQuestion: QuizQuestion = {
      id: qId,
      quiz_id: quizId,
      question_text: dto.question_text,
      answer_text: fields.answer_text,
      question_type: fields.question_type,
      options: fields.options,
      correct_answer: fields.correct_answer,
      explanation: dto.explanation || null,
      correct_explanation: fields.correct_explanation || null,
      distractor_explanations: fields.distractor_explanations || null,
      discriminatory_keywords: fields.discriminatory_keywords || null,
      source_pages: dto.source_pages || [],
      order_index: orderIndex,
      created_at: new Date().toISOString()
    };
    this.inMemoryQuestions.set(qId, newQuestion);
    quiz.question_count = questions.length + 1;
    this.inMemoryQuizzes.set(quizId, quiz);
    this.persistToStorage();
    return newQuestion;
  }

  async updateQuestion(quizId: string, questionId: string, dto: UpdateQuestionDto, userId?: string): Promise<QuizQuestion> {
    await this.requireQuizWriteAccess(quizId, userId);
    const question = this.inMemoryQuestions.get(questionId);
    if (!question || question.quiz_id !== quizId) throw new Error('Question not found');
    const fields = normalizeQuestionFields(dto, question);
    if (dto.question_text !== undefined) question.question_text = dto.question_text;
    question.answer_text = fields.answer_text;
    question.question_type = fields.question_type;
    question.options = fields.options;
    question.correct_answer = fields.correct_answer;
    if (dto.explanation !== undefined) question.explanation = dto.explanation;
    question.correct_explanation = fields.correct_explanation;
    question.distractor_explanations = fields.distractor_explanations;
    question.discriminatory_keywords = fields.discriminatory_keywords;
    if (dto.source_pages !== undefined) question.source_pages = dto.source_pages;
    this.inMemoryQuestions.set(questionId, question);
    this.persistToStorage();
    return question;
  }

  async deleteQuestion(quizId: string, questionId: string, userId?: string): Promise<boolean> {
    await this.requireQuizWriteAccess(quizId, userId);
    const question = this.inMemoryQuestions.get(questionId);
    if (!question || question.quiz_id !== quizId) return false;
    this.inMemoryQuestions.delete(questionId);
    const quiz = this.inMemoryQuizzes.get(quizId);
    if (quiz) {
      const remaining = await this.getQuestionsByQuizId(quizId, userId);
      quiz.question_count = remaining.length;
      this.inMemoryQuizzes.set(quizId, quiz);
    }
    this.persistToStorage();
    return true;
  }

  async reorderQuestions(quizId: string, questionIds: string[], userId?: string): Promise<boolean> {
    await this.requireQuizWriteAccess(quizId, userId);
    const questions = await this.getQuestionsByQuizId(quizId, userId);
    const expectedIds = new Set(questions.map((question) => question.id));
    if (questionIds.length !== questions.length || questionIds.some((id) => !expectedIds.has(id))) {
      throw new Error('Question order must contain every question in this quiz exactly once');
    }
    questionIds.forEach((id, index) => {
      const q = this.inMemoryQuestions.get(id)!;
      q.order_index = index;
      this.inMemoryQuestions.set(id, q);
    });
    this.persistToStorage();
    return true;
  }

  async getShareConfig(quizId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean; allow_public_answer_key?: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    const quiz = await this.requireQuizOwnerAccess(quizId, userId);
    if (!quiz.share_token) {
      quiz.share_token = generateShareToken();
      quiz.is_public = quiz.is_public ?? true;
      quiz.allow_cloning = quiz.allow_cloning ?? true;
      quiz.share_revoked_at = null;
      this.inMemoryQuizzes.set(quizId, quiz);
      this.persistToStorage();
    }
    return {
      share_token: quiz.share_token,
      is_public: quiz.is_public ?? true,
      allow_cloning: quiz.allow_cloning ?? true,
      allow_public_answer_key: quiz.allow_public_answer_key ?? false,
      share_expires_at: quiz.share_expires_at ?? null,
      share_revoked_at: quiz.share_revoked_at ?? null
    };
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean; allow_public_answer_key?: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    const quiz = await this.requireQuizOwnerAccess(quizId, userId);
    const wasRevoked = Boolean(quiz.share_revoked_at) || quiz.is_public === false;
    if (dto.reset_token || !quiz.share_token || (dto.is_public === true && wasRevoked)) {
      quiz.share_token = generateShareToken();
      quiz.share_revoked_at = null;
    }
    if (dto.is_public !== undefined) {
      quiz.is_public = dto.is_public;
      if (!dto.is_public) quiz.share_revoked_at = new Date().toISOString();
    }
    if (dto.allow_cloning !== undefined) quiz.allow_cloning = dto.allow_cloning;
    if (dto.allow_public_answer_key !== undefined) quiz.allow_public_answer_key = dto.allow_public_answer_key;
    if (dto.share_expires_at !== undefined) quiz.share_expires_at = dto.share_expires_at;
    this.inMemoryQuizzes.set(quizId, quiz);
    this.persistToStorage();
    return {
      share_token: quiz.share_token,
      is_public: quiz.is_public ?? true,
      allow_cloning: quiz.allow_cloning ?? true,
      allow_public_answer_key: quiz.allow_public_answer_key ?? false,
      share_expires_at: quiz.share_expires_at ?? null,
      share_revoked_at: quiz.share_revoked_at ?? null
    };
  }

  async getSubjectAccess(subjectId: string, userId?: string): Promise<SubjectAccess | null> {
    const subject = this.inMemorySubjects.get(subjectId);
    if (!subject) return null;
    if (userId && subject.user_id === userId) return { subject_id: subjectId, role: 'owner', can_edit: true, can_edit_reviewers: true, can_manage: true };
    if (userId && this.collaborators.get(subjectId)?.has(userId)) return { subject_id: subjectId, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false };
    if (isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at)) {
      return { subject_id: subjectId, role: 'public', can_edit: false, can_edit_reviewers: false, can_manage: false };
    }
    return null;
  }

  async listQuizzesBySubject(subjectId: string, userId?: string): Promise<Quiz[]> {
    const access = await this.getSubjectAccess(subjectId, userId);
    if (!access) throw new Error('Subject not found or access is restricted');
    return Array.from(this.inMemoryQuizzes.values())
      .filter((quiz) => quiz.subject_id === subjectId)
      .filter((quiz) => access.role !== 'public' || isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at))
      .map((quiz) => ({ ...quiz, subject: this.inMemorySubjects.get(subjectId) || null }));
  }

  async updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string): Promise<Subject> {
    if (!(await this.getSubjectAccess(subjectId, userId))?.can_edit) throw new Error('Subject not found or access is restricted');
    const subject = this.inMemorySubjects.get(subjectId)!;
    if (dto.name !== undefined) subject.name = dto.name;
    if (dto.color !== undefined) subject.color = dto.color;
    this.inMemorySubjects.set(subjectId, subject);
    this.persistToStorage();
    return subject;
  }

  async createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string, maxUses: number = 5): Promise<SubjectCollaboratorLink> {
    const access = await this.getSubjectAccess(subjectId, userId);
    if (!access?.can_manage) throw new Error('Only the subject owner can create collaborator links');
    const clampedUses = Math.min(Math.max(Number(maxUses) || 1, 1), 5);
    const token = generateSecureToken(48);
    this.collaboratorLinks.set(token, {
      subject_id: subjectId,
      expires_at: expiresAt,
      used_at: null,
      user_id: null,
      max_uses: clampedUses,
      uses_count: 0,
      redeemed_by: []
    });
    this.persistToStorage();
    return { token, expires_at: expiresAt, used_at: null, max_uses: clampedUses, uses_count: 0, redeemed_by: [] };
  }

  async redeemSubjectCollaboratorLink(token: string, userId: string): Promise<SubjectAccess | null> {
    const link = this.collaboratorLinks.get(token);
    if (!link) return null;
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return null;

    const redeemedBy = Array.isArray(link.redeemed_by) ? link.redeemed_by : [];
    // If the same user/device opens the link again, usage count stays the same
    if (redeemedBy.includes(userId)) {
      const members = this.collaborators.get(link.subject_id) || new Set<string>();
      members.add(userId);
      this.collaborators.set(link.subject_id, members);
      return { subject_id: link.subject_id, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false };
    }

    // Different user/device: check remaining uses
    const usesCount = link.uses_count ?? 0;
    const maxUses = link.max_uses ?? 1;
    if (usesCount >= maxUses || link.used_at) return null;

    link.redeemed_by = [...redeemedBy, userId];
    link.uses_count = usesCount + 1;
    link.user_id = userId;
    if (link.uses_count >= maxUses) {
      link.used_at = new Date().toISOString();
    }
    this.collaboratorLinks.set(token, link);

    const members = this.collaborators.get(link.subject_id) || new Set<string>();
    members.add(userId);
    this.collaborators.set(link.subject_id, members);
    this.persistToStorage();
    return { subject_id: link.subject_id, role: 'collaborator', can_edit: false, can_edit_reviewers: true, can_manage: false };
  }

  async deleteSubject(subjectId: string, userId?: string): Promise<boolean> {
    if (!userId) throw new Error('Authenticated user required for subject management');
    const subject = this.inMemorySubjects.get(subjectId);
    if (!subject || !subject.user_id || subject.user_id !== userId) return false;

    for (const [quizId, quiz] of this.inMemoryQuizzes.entries()) {
      if (quiz.subject_id !== subjectId) continue;
      this.inMemoryQuizzes.delete(quizId);
      for (const [questionId, question] of this.inMemoryQuestions.entries()) {
        if (question.quiz_id === quizId) this.inMemoryQuestions.delete(questionId);
      }
    }

    const deleted = this.inMemorySubjects.delete(subjectId);
    for (const token of Array.from(this.collaboratorLinks.keys())) {
      if (this.collaboratorLinks.get(token)?.subject_id === subjectId) this.collaboratorLinks.delete(token);
    }
    this.collaborators.delete(subjectId);
    this.persistToStorage();
    return deleted;
  }

  async recordSubjectView(subjectId: string, viewerId: string): Promise<void> {
    const subject = this.inMemorySubjects.get(subjectId);
    if (!subject || subject.user_id === viewerId) return;
    const access = await this.getSubjectAccess(subjectId, viewerId);
    const isPublic = isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at);
    if (!access && !isPublic) return;
    const viewers = this.subjectViews.get(subjectId) || new Set<string>();
    viewers.add(viewerId);
    this.subjectViews.set(subjectId, viewers);
  }

  async getSubjectViewerCount(subjectId: string, ownerId: string): Promise<number> {
    const subject = this.inMemorySubjects.get(subjectId);
    if (!subject || subject.user_id !== ownerId) return 0;
    return this.subjectViews.get(subjectId)?.size || 0;
  }

  async getSubjectShareConfig(subjectId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    if (!userId) throw new Error('Authenticated user required for subject sharing');
    const subject = this.inMemorySubjects.get(subjectId);
    if (!subject) throw new Error(`Subject ${subjectId} not found`);
    if (subject.user_id !== userId) throw new Error(`Subject ${subjectId} not found`);
    if (!subject.share_token) {
      subject.share_token = generateShareToken();
      subject.is_public = subject.is_public ?? true;
      subject.share_revoked_at = null;
      this.inMemorySubjects.set(subjectId, subject);
      this.persistToStorage();
    }
    return {
      share_token: subject.share_token,
      is_public: subject.is_public ?? true,
      share_expires_at: subject.share_expires_at ?? null,
      share_revoked_at: subject.share_revoked_at ?? null
    };
  }

  async updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }> {
    if (!userId) throw new Error('Authenticated user required for subject sharing');
    const subject = this.inMemorySubjects.get(subjectId);
    if (!subject || subject.user_id !== userId) throw new Error(`Subject ${subjectId} not found`);
    const wasRevoked = Boolean(subject.share_revoked_at) || subject.is_public === false;
    if (dto.reset_token || !subject.share_token || (dto.is_public === true && wasRevoked)) {
      subject.share_token = generateShareToken();
      subject.share_revoked_at = null;
    }
    if (dto.is_public !== undefined) {
      subject.is_public = dto.is_public;
      if (!dto.is_public) subject.share_revoked_at = new Date().toISOString();
    }
    if (dto.share_expires_at !== undefined) subject.share_expires_at = dto.share_expires_at;
    this.inMemorySubjects.set(subjectId, subject);
    this.persistToStorage();
    return {
      share_token: subject.share_token,
      is_public: subject.is_public ?? true,
      share_expires_at: subject.share_expires_at ?? null,
      share_revoked_at: subject.share_revoked_at ?? null
    };
  }

  async getSubjectByShareToken(shareToken: string) {
    const subject = Array.from(this.inMemorySubjects.values()).find((candidate) => candidate.share_token === shareToken);
    if (!subject || !isShareTokenActive(subject.is_public, subject.share_expires_at, subject.share_revoked_at)) return null;
    const quizzes = Array.from(this.inMemoryQuizzes.values()).filter((quiz) =>
      quiz.subject_id === subject.id && isShareTokenActive(quiz.is_public, quiz.share_expires_at, quiz.share_revoked_at)
    );
    return toPublicSubjectDto(subject, quizzes);
  }

  async getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null> {
    const matchedQuiz = Array.from(this.inMemoryQuizzes.values()).find((quiz) => quiz.share_token === shareToken);
    if (!matchedQuiz || !isShareTokenActive(matchedQuiz.is_public, matchedQuiz.share_expires_at, matchedQuiz.share_revoked_at)) return null;
    const questions = await this.getQuestionsByQuizId(matchedQuiz.id);
    const subject = matchedQuiz.subject_id ? this.inMemorySubjects.get(matchedQuiz.subject_id) : null;
    return toPublicQuizDto(matchedQuiz, questions, subject);
  }

  async cloneQuizByShareToken(shareToken: string, userId?: string): Promise<Quiz> {
    const matchedQuiz = Array.from(this.inMemoryQuizzes.values()).find((quiz) => quiz.share_token === shareToken);
    if (!matchedQuiz || !isShareTokenActive(matchedQuiz.is_public, matchedQuiz.share_expires_at, matchedQuiz.share_revoked_at)) throw new Error('Shared set not found or access is restricted.');
    if (!matchedQuiz.allow_cloning) throw new Error('Creator has disabled cloning for this study set.');
    const questions = await this.getQuestionsByQuizId(matchedQuiz.id);
    return this.createQuiz({
      title: `${matchedQuiz.title} (Copy)`,
      description: matchedQuiz.description || null,
      term: matchedQuiz.term || null,
      subject_id: null,
      source_model: 'cloned',
      questions: questions.map((question) => ({
        question_text: question.question_text,
        answer_text: question.answer_text || null,
        question_type: question.question_type || null,
        options: question.options,
        correct_answer: question.correct_answer,
        explanation: question.explanation || null,
        correct_explanation: question.correct_explanation || null,
        distractor_explanations: question.distractor_explanations || null,
        discriminatory_keywords: question.discriminatory_keywords || null,
        source_pages: question.source_pages || null
      }))
    }, userId);
  }
}

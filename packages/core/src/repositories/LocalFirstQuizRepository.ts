import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject } from '@quiz-creator/types';
import { normalizeQuestionFields } from './questionFields';

const STORAGE_KEY_QUIZZES = 'quiz_creator_quizzes_v1';
const STORAGE_KEY_QUESTIONS = 'quiz_creator_questions_v1';
const STORAGE_KEY_SUBJECTS = 'quiz_creator_subjects_v1';

export class LocalFirstQuizRepository implements IQuizRepository {
  private inMemorySubjects: Map<string, Subject> = new Map();
  private inMemoryQuizzes: Map<string, Quiz> = new Map();
  private inMemoryQuestions: Map<string, QuizQuestion> = new Map();

  constructor() {
    this.hydrateFromStorage();
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
    } catch (e) {
      console.warn('[LocalFirstQuizRepository] Failed to persist to storage:', e);
    }
  }

  async listSubjects(userId?: string): Promise<Subject[]> {
    const list = Array.from(this.inMemorySubjects.values());
    return userId ? list.filter(s => !s.user_id || s.user_id === userId) : list;
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const subject: Subject = {
      id,
      name,
      color,
      user_id: userId,
      share_token: Math.random().toString(36).substring(2, 12),
      is_public: true,
      created_at: new Date().toISOString()
    };
    this.inMemorySubjects.set(id, subject);
    this.persistToStorage();
    return subject;
  }

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    const all = Array.from(this.inMemoryQuizzes.values());
    const filtered = userId ? all.filter(q => q.user_id === userId) : all;
    return filtered.map(q => ({
      ...q,
      subject: q.subject_id ? this.inMemorySubjects.get(q.subject_id) || null : null
    }));
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    const quiz = this.inMemoryQuizzes.get(id);
    if (!quiz) return null;
    if (userId && quiz.user_id && quiz.user_id !== userId) return null;
    return {
      ...quiz,
      subject: quiz.subject_id ? this.inMemorySubjects.get(quiz.subject_id) || null : null
    };
  }

  async createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz> {
    const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newQuiz: Quiz = {
      id: quizId,
      title: dto.title,
      description: dto.description || null,
      question_count: dto.questions.length,
      generated_at: new Date().toISOString(),
      handout_name: dto.handout_name || null,
      source_model: dto.source_model || 'manual',
      subject_id: dto.subject_id || null,
      user_id: userId || null,
      share_token: Math.random().toString(36).substring(2, 12),
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
        source_pages: q.source_pages || [],
        order_index: idx,
        created_at: new Date().toISOString()
      });
    });

    this.persistToStorage();
    return newQuiz;
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    const quiz = await this.getQuizById(id, userId);
    if (!quiz) throw new Error(`Quiz ${id} not found`);
    if (dto.title !== undefined) quiz.title = dto.title;
    if (dto.description !== undefined) quiz.description = dto.description;
    if (dto.subject_id !== undefined) quiz.subject_id = dto.subject_id;
    this.inMemoryQuizzes.set(id, quiz);
    this.persistToStorage();
    return quiz;
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    const quiz = await this.getQuizById(id, userId);
    if (!quiz) return false;
    const deleted = this.inMemoryQuizzes.delete(id);
    for (const [qId, q] of this.inMemoryQuestions.entries()) {
      if (q.quiz_id === id) this.inMemoryQuestions.delete(qId);
    }
    this.persistToStorage();
    return deleted;
  }

  async getQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    const list: QuizQuestion[] = [];
    for (const q of this.inMemoryQuestions.values()) {
      if (q.quiz_id === quizId) list.push(q);
    }
    return list.sort((a, b) => a.order_index - b.order_index);
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto): Promise<QuizQuestion> {
    const quiz = this.inMemoryQuizzes.get(quizId);
    if (!quiz) throw new Error(`Quiz ${quizId} not found`);

    const questions = await this.getQuestionsByQuizId(quizId);
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
      source_pages: dto.source_pages || [],
      order_index: orderIndex,
      created_at: new Date().toISOString()
    };
    this.inMemoryQuestions.set(qId, newQuestion);
    quiz.question_count = questions.length + 1;
    this.persistToStorage();
    return newQuestion;
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto): Promise<QuizQuestion> {
    const question = this.inMemoryQuestions.get(questionId);
    if (!question) throw new Error(`Question ${questionId} not found`);
    const fields = normalizeQuestionFields(dto, question);
    if (dto.question_text !== undefined) question.question_text = dto.question_text;
    question.answer_text = fields.answer_text;
    question.question_type = fields.question_type;
    question.options = fields.options;
    question.correct_answer = fields.correct_answer;
    if (dto.explanation !== undefined) question.explanation = dto.explanation;
    if (dto.source_pages !== undefined) question.source_pages = dto.source_pages;
    this.inMemoryQuestions.set(questionId, question);
    this.persistToStorage();
    return question;
  }

  async deleteQuestion(questionId: string): Promise<boolean> {
    const question = this.inMemoryQuestions.get(questionId);
    if (!question) return false;
    this.inMemoryQuestions.delete(questionId);
    const quiz = this.inMemoryQuizzes.get(question.quiz_id);
    if (quiz) {
      const remaining = await this.getQuestionsByQuizId(quiz.id);
      quiz.question_count = remaining.length;
    }
    this.persistToStorage();
    return true;
  }

  async reorderQuestions(quizId: string, questionIds: string[]): Promise<boolean> {
    questionIds.forEach((id, index) => {
      const q = this.inMemoryQuestions.get(id);
      if (q && q.quiz_id === quizId) {
        q.order_index = index;
        this.inMemoryQuestions.set(id, q);
      }
    });
    this.persistToStorage();
    return true;
  }

  async getShareConfig(quizId: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    const quiz = this.inMemoryQuizzes.get(quizId);
    if (!quiz) throw new Error(`Quiz ${quizId} not found`);

    if (!quiz.share_token) {
      quiz.share_token = Math.random().toString(36).substring(2, 10);
      quiz.is_public = quiz.is_public ?? true;
      quiz.allow_cloning = quiz.allow_cloning ?? true;
      this.inMemoryQuizzes.set(quizId, quiz);
      this.persistToStorage();
    }

    return {
      share_token: quiz.share_token,
      is_public: quiz.is_public ?? true,
      allow_cloning: quiz.allow_cloning ?? true
    };
  }

  async updateShareConfig(quizId: string, dto: { is_public?: boolean; allow_cloning?: boolean; reset_token?: boolean }): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    const quiz = this.inMemoryQuizzes.get(quizId);
    if (!quiz) throw new Error(`Quiz ${quizId} not found`);

    if (dto.reset_token || !quiz.share_token) {
      quiz.share_token = Math.random().toString(36).substring(2, 10);
    }
    if (dto.is_public !== undefined) quiz.is_public = dto.is_public;
    if (dto.allow_cloning !== undefined) quiz.allow_cloning = dto.allow_cloning;

    this.inMemoryQuizzes.set(quizId, quiz);
    this.persistToStorage();

    return {
      share_token: quiz.share_token,
      is_public: quiz.is_public ?? true,
      allow_cloning: quiz.allow_cloning ?? true
    };
  }

  async getSubjectShareConfig(subjectId: string, userId?: string): Promise<{ share_token: string; is_public: boolean }> {
    const subject = this.inMemorySubjects.get(subjectId);
    if (!subject || (userId && subject.user_id && subject.user_id !== userId)) {
      throw new Error(`Subject ${subjectId} not found`);
    }

    if (!subject.share_token) {
      subject.share_token = Math.random().toString(36).substring(2, 12);
      subject.is_public = subject.is_public ?? true;
      this.inMemorySubjects.set(subjectId, subject);
      this.persistToStorage();
    }

    return {
      share_token: subject.share_token,
      is_public: subject.is_public ?? true
    };
  }

  async updateSubjectShareConfig(
    subjectId: string,
    dto: { is_public?: boolean; reset_token?: boolean },
    userId?: string
  ): Promise<{ share_token: string; is_public: boolean }> {
    const subject = this.inMemorySubjects.get(subjectId);
    if (!subject || (userId && subject.user_id && subject.user_id !== userId)) {
      throw new Error(`Subject ${subjectId} not found`);
    }

    if (dto.reset_token || !subject.share_token) {
      subject.share_token = Math.random().toString(36).substring(2, 12);
    }
    if (dto.is_public !== undefined) subject.is_public = dto.is_public;
    this.inMemorySubjects.set(subjectId, subject);
    this.persistToStorage();

    return {
      share_token: subject.share_token,
      is_public: subject.is_public ?? true
    };
  }

  async getSubjectByShareToken(shareToken: string) {
    const subject = Array.from(this.inMemorySubjects.values()).find((candidate) => candidate.share_token === shareToken);
    if (!subject || subject.is_public === false) return null;

    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      share_token: subject.share_token!,
      is_public: subject.is_public ?? true,
      created_at: subject.created_at,
      quizzes: Array.from(this.inMemoryQuizzes.values())
        .filter((quiz) => quiz.subject_id === subject.id && quiz.is_public !== false && Boolean(quiz.share_token))
        .map((quiz) => ({
          id: quiz.id,
          title: quiz.title,
          description: quiz.description || null,
          question_count: quiz.question_count,
          generated_at: quiz.generated_at,
          share_token: quiz.share_token!,
          is_public: quiz.is_public ?? true,
          created_at: quiz.created_at
        }))
    };
  }

  async getQuizByShareToken(shareToken: string) {
    let matchedQuiz: Quiz | null = null;
    for (const q of this.inMemoryQuizzes.values()) {
      if (q.share_token === shareToken) {
        matchedQuiz = q;
        break;
      }
    }

    if (!matchedQuiz || matchedQuiz.is_public === false) return null;

    const questions = await this.getQuestionsByQuizId(matchedQuiz.id);
    const subject = matchedQuiz.subject_id ? this.inMemorySubjects.get(matchedQuiz.subject_id) : null;

    return {
      id: matchedQuiz.id,
      title: matchedQuiz.title,
      description: matchedQuiz.description || null,
      question_count: matchedQuiz.question_count || questions.length,
      generated_at: matchedQuiz.generated_at,
      source_model: matchedQuiz.source_model,
      share_token: matchedQuiz.share_token || shareToken,
      is_public: matchedQuiz.is_public ?? true,
      allow_cloning: matchedQuiz.allow_cloning ?? true,
      created_at: matchedQuiz.created_at,
      subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
      questions: questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        answer_text: q.answer_text || q.options[q.correct_answer] || null,
        question_type: q.question_type || (q.options.length > 1 ? 'multiple_choice' : 'typed_answer'),
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        order_index: q.order_index
      }))
    };
  }

  async cloneQuizByShareToken(shareToken: string, userId?: string): Promise<Quiz> {
    const publicQuiz = await this.getQuizByShareToken(shareToken);
    if (!publicQuiz) throw new Error('Shared set not found or access is restricted.');
    if (!publicQuiz.allow_cloning) throw new Error('Creator has disabled cloning for this study set.');

    return await this.createQuiz({
      title: `${publicQuiz.title} (Copy)`,
      description: publicQuiz.description || null,
      subject_id: publicQuiz.subject?.id || null,
      source_model: 'cloned',
      questions: publicQuiz.questions.map(q => ({
        question_text: q.question_text,
        answer_text: q.answer_text || null,
        question_type: q.question_type || null,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null
      }))
    }, userId);
  }
}

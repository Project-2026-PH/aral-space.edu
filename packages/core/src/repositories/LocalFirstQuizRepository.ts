import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject } from '@quiz-creator/types';

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
    return userId ? list.filter(s => s.user_id === userId) : list;
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const subject: Subject = { id, name, color, user_id: userId, created_at: new Date().toISOString() };
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
      question_count: dto.questions.length,
      generated_at: new Date().toISOString(),
      handout_name: dto.handout_name || null,
      source_model: dto.source_model || 'manual',
      subject_id: dto.subject_id || null,
      user_id: userId || null,
      created_at: new Date().toISOString()
    };
    this.inMemoryQuizzes.set(quizId, newQuiz);

    dto.questions.forEach((q, idx) => {
      const qId = `q-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
      this.inMemoryQuestions.set(qId, {
        id: qId,
        quiz_id: quizId,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
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

    const newQuestion: QuizQuestion = {
      id: qId,
      quiz_id: quizId,
      question_text: dto.question_text,
      options: dto.options,
      correct_answer: dto.correct_answer,
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
    if (dto.question_text !== undefined) question.question_text = dto.question_text;
    if (dto.options !== undefined) question.options = dto.options;
    if (dto.correct_answer !== undefined) question.correct_answer = dto.correct_answer;
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
}

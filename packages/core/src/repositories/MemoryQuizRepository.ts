import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto } from '@quiz-creator/types';
import { normalizeQuestionFields } from './questionFields';

function generateShareSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 10; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

export class MemoryQuizRepository implements IQuizRepository {
  private subjects: Map<string, Subject> = new Map();
  private quizzes: Map<string, Quiz> = new Map();
  private questions: Map<string, QuizQuestion> = new Map();

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    const defaultSubject: Subject = {
      id: 'sub-default-1',
      name: 'General Knowledge',
      color: '#6366f1',
      created_at: new Date().toISOString()
    };
    this.subjects.set(defaultSubject.id, defaultSubject);

    const defaultQuiz: Quiz = {
      id: 'quiz-demo-1',
      title: 'Welcome to Quiz Mastery',
      question_count: 5,
      generated_at: new Date().toISOString(),
      handout_name: 'Introduction Handout',
      source_model: 'manual',
      subject_id: defaultSubject.id,
      share_token: 'demo-welcome',
      is_public: true,
      allow_cloning: true,
      created_at: new Date().toISOString(),
      subject: defaultSubject
    };
    this.quizzes.set(defaultQuiz.id, defaultQuiz);

    const demoQuestions: CreateQuestionDto[] = [
      {
        question_text: "What is the primary benefit of the Leitner Spaced Repetition method?",
        options: [
          "Optimizes long-term memory retention by spacing review intervals",
          "Crams large volumes of information overnight",
          "Randomizes questions without any interval schedule",
          "Eliminates the need for practice questions"
        ],
        correct_answer: 0,
        explanation: "Spaced repetition leverages the psychological spacing effect to systematically review material before you forget it.",
        source_pages: [1],
        order_index: 0
      },
      {
        question_text: "In this Quiz Mastery engine, what is the default batch size of active questions?",
        options: ["10 questions", "5 questions", "3 questions", "20 questions"],
        correct_answer: 1,
        explanation: "Batches are grouped into 5 questions to maximize focus without cognitive overload.",
        source_pages: [1],
        order_index: 1
      },
      {
        question_text: "Which architectural pattern organizes code into Model -> Service -> Repository -> Controller?",
        options: ["MVC", "MSRC", "MVVM", "CQRS"],
        correct_answer: 1,
        explanation: "MSRC explicitly separates Domain Data Models, Business Services, Storage Repositories, and Dispatch Controllers.",
        source_pages: [2],
        order_index: 2
      },
      {
        question_text: "What occurs when a question is answered incorrectly during a mastery session?",
        options: [
          "The question is permanently removed",
          "The streak resets to 0 and the question repeats in the cycle until mastered",
          "The session aborts immediately",
          "The score is halved"
        ],
        correct_answer: 1,
        explanation: "Incorrect answers mark has_missed=true and reset the active streak so you must review it again in the loop.",
        source_pages: [2],
        order_index: 3
      },
      {
        question_text: "Which AI model family powers the automated Handout Quiz generator?",
        options: ["Google Gemini", "GPT-2", "Claude 1", "BERT"],
        correct_answer: 0,
        explanation: "Google Gemini GenAI SDK is used for high-speed streaming question generation from study materials.",
        source_pages: [3],
        order_index: 4
      }
    ];

    demoQuestions.forEach((q, idx) => {
      const id = `q-demo-${idx + 1}`;
      const fields = normalizeQuestionFields(q);
      this.questions.set(id, {
        id,
        quiz_id: defaultQuiz.id,
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
  }

  async listSubjects(userId?: string): Promise<Subject[]> {
    const list = Array.from(this.subjects.values());
    return userId ? list.filter(s => !s.user_id || s.user_id === userId) : list;
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const subject: Subject = {
      id,
      name,
      color,
      user_id: userId,
      share_token: generateShareSlug(),
      is_public: true,
      created_at: new Date().toISOString()
    };
    this.subjects.set(id, subject);
    return subject;
  }

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    const all = Array.from(this.quizzes.values());
    const filtered = userId ? all.filter(q => !q.user_id || q.user_id === userId) : all;
    return filtered.map(q => ({
      ...q,
      subject: q.subject_id ? this.subjects.get(q.subject_id) || null : null
    }));
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    const quiz = this.quizzes.get(id);
    if (!quiz) return null;
    if (userId && quiz.user_id && quiz.user_id !== userId) return null;
    return {
      ...quiz,
      subject: quiz.subject_id ? this.subjects.get(quiz.subject_id) || null : null
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
      share_token: generateShareSlug(),
      is_public: true,
      allow_cloning: true,
      created_at: new Date().toISOString()
    };
    this.quizzes.set(quizId, newQuiz);

    dto.questions.forEach((q, idx) => {
      const qId = `q-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
      const fields = normalizeQuestionFields(q);
      this.questions.set(qId, {
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

    return newQuiz;
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    const quiz = await this.getQuizById(id, userId);
    if (!quiz) throw new Error(`Quiz ${id} not found`);
    if (dto.title !== undefined) quiz.title = dto.title;
    if (dto.description !== undefined) quiz.description = dto.description;
    if (dto.subject_id !== undefined) quiz.subject_id = dto.subject_id;
    this.quizzes.set(id, quiz);
    return quiz;
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    const quiz = await this.getQuizById(id, userId);
    if (!quiz) return false;
    const deleted = this.quizzes.delete(id);
    for (const [qId, q] of this.questions.entries()) {
      if (q.quiz_id === id) this.questions.delete(qId);
    }
    return deleted;
  }

  async getQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    const list: QuizQuestion[] = [];
    for (const q of this.questions.values()) {
      if (q.quiz_id === quizId) list.push(q);
    }
    return list.sort((a, b) => a.order_index - b.order_index);
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto): Promise<QuizQuestion> {
    const quiz = this.quizzes.get(quizId);
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
    this.questions.set(qId, newQuestion);
    quiz.question_count = questions.length + 1;
    return newQuestion;
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto): Promise<QuizQuestion> {
    const question = this.questions.get(questionId);
    if (!question) throw new Error(`Question ${questionId} not found`);
    const fields = normalizeQuestionFields(dto, question);
    if (dto.question_text !== undefined) question.question_text = dto.question_text;
    question.answer_text = fields.answer_text;
    question.question_type = fields.question_type;
    question.options = fields.options;
    question.correct_answer = fields.correct_answer;
    if (dto.explanation !== undefined) question.explanation = dto.explanation;
    if (dto.source_pages !== undefined) question.source_pages = dto.source_pages;
    this.questions.set(questionId, question);
    return question;
  }

  async deleteQuestion(questionId: string): Promise<boolean> {
    const question = this.questions.get(questionId);
    if (!question) return false;
    this.questions.delete(questionId);
    const quiz = this.quizzes.get(question.quiz_id);
    if (quiz) {
      const remaining = await this.getQuestionsByQuizId(quiz.id);
      quiz.question_count = remaining.length;
    }
    return true;
  }

  async reorderQuestions(quizId: string, questionIds: string[]): Promise<boolean> {
    questionIds.forEach((id, index) => {
      const q = this.questions.get(id);
      if (q && q.quiz_id === quizId) {
        q.order_index = index;
        this.questions.set(id, q);
      }
    });
    return true;
  }

  async getShareConfig(quizId: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) throw new Error(`Quiz ${quizId} not found`);

    if (!quiz.share_token) {
      quiz.share_token = generateShareSlug();
      if (quiz.is_public === undefined) quiz.is_public = true;
      if (quiz.allow_cloning === undefined) quiz.allow_cloning = true;
      this.quizzes.set(quizId, quiz);
    }

    return {
      share_token: quiz.share_token,
      is_public: quiz.is_public ?? true,
      allow_cloning: quiz.allow_cloning ?? true
    };
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) throw new Error(`Quiz ${quizId} not found`);

    if (dto.reset_token || !quiz.share_token) {
      quiz.share_token = generateShareSlug();
    }
    if (dto.is_public !== undefined) {
      quiz.is_public = dto.is_public;
    }
    if (dto.allow_cloning !== undefined) {
      quiz.allow_cloning = dto.allow_cloning;
    }

    this.quizzes.set(quizId, quiz);

    return {
      share_token: quiz.share_token,
      is_public: quiz.is_public ?? true,
      allow_cloning: quiz.allow_cloning ?? true
    };
  }

  async getSubjectShareConfig(subjectId: string, userId?: string): Promise<{ share_token: string; is_public: boolean }> {
    const subject = this.subjects.get(subjectId);
    if (!subject || (userId && subject.user_id && subject.user_id !== userId)) {
      throw new Error(`Subject ${subjectId} not found`);
    }

    if (!subject.share_token) {
      subject.share_token = generateShareSlug();
      subject.is_public = subject.is_public ?? true;
      this.subjects.set(subjectId, subject);
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
    const subject = this.subjects.get(subjectId);
    if (!subject || (userId && subject.user_id && subject.user_id !== userId)) {
      throw new Error(`Subject ${subjectId} not found`);
    }

    if (dto.reset_token || !subject.share_token) {
      subject.share_token = generateShareSlug();
    }
    if (dto.is_public !== undefined) {
      subject.is_public = dto.is_public;
    }
    this.subjects.set(subjectId, subject);

    return {
      share_token: subject.share_token,
      is_public: subject.is_public ?? true
    };
  }

  async getSubjectByShareToken(shareToken: string) {
    const subject = Array.from(this.subjects.values()).find((candidate) => candidate.share_token === shareToken);
    if (!subject || subject.is_public === false) return null;

    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      share_token: subject.share_token!,
      is_public: subject.is_public ?? true,
      created_at: subject.created_at,
      quizzes: Array.from(this.quizzes.values())
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

  async getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null> {
    let matchedQuiz: Quiz | null = null;
    for (const q of this.quizzes.values()) {
      if (q.share_token === shareToken) {
        matchedQuiz = q;
        break;
      }
    }

    if (!matchedQuiz) return null;
    if (matchedQuiz.is_public === false) return null;

    const questions = await this.getQuestionsByQuizId(matchedQuiz.id);
    const subject = matchedQuiz.subject_id ? this.subjects.get(matchedQuiz.subject_id) : null;

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

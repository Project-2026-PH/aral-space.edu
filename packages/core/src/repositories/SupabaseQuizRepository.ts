import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto } from '@quiz-creator/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { MemoryQuizRepository } from './MemoryQuizRepository';

function generateShareSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 10; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

const memoryFallback = new MemoryQuizRepository();

export class SupabaseQuizRepository implements IQuizRepository {
  private fallback: IQuizRepository;

  constructor(private supabase: SupabaseClient, fallback?: IQuizRepository) {
    this.fallback = fallback || memoryFallback;
  }

  async listSubjects(userId?: string): Promise<Subject[]> {
    try {
      let query = this.supabase.from('subjects').select('*').order('name');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
    } catch (e) {}
    return this.fallback.listSubjects();
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    try {
      const { data, error } = await this.supabase
        .from('subjects')
        .insert({ name, color, user_id: userId })
        .select('*')
        .single();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.createSubject(name, color, userId);
  }

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    try {
      let query = this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .order('generated_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
    } catch (e) {}
    return this.fallback.listQuizzes();
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    try {
      let query = this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .eq('id', id);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.maybeSingle();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.getQuizById(id);
  }

  async createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz> {
    const shareToken = generateShareSlug();
    try {
      const { data: quizData, error: quizError } = await this.supabase
        .from('quizzes')
        .insert({
          title: dto.title,
          question_count: dto.questions.length,
          handout_name: dto.handout_name,
          source_model: dto.source_model || 'manual',
          subject_id: dto.subject_id,
          share_token: shareToken,
          is_public: true,
          allow_cloning: true,
          user_id: userId
        })
        .select('*')
        .single();

      if (!quizError && quizData) {
        if (dto.questions.length > 0) {
          const rows = dto.questions.map((q, idx) => ({
            quiz_id: quizData.id,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            source_pages: q.source_pages,
            order_index: idx
          }));

          await this.supabase.from('quiz_questions').insert(rows);
        }

        return quizData;
      }
    } catch (e) {}

    return this.fallback.createQuiz(dto, userId);
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    try {
      let query = this.supabase.from('quizzes').update(dto).eq('id', id);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.select('*').single();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.updateQuiz(id, dto);
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    try {
      let query = this.supabase.from('quizzes').delete().eq('id', id);
      if (userId) query = query.eq('user_id', userId);
      const { error } = await query;
      if (!error) return true;
    } catch (e) {}
    return this.fallback.deleteQuiz(id);
  }

  async getQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    try {
      const { data, error } = await this.supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });
      if (!error && data && data.length > 0) return data;
    } catch (e) {}
    return this.fallback.getQuestionsByQuizId(quizId);
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto): Promise<QuizQuestion> {
    try {
      const { data, error } = await this.supabase
        .from('quiz_questions')
        .insert({
          quiz_id: quizId,
          question_text: dto.question_text,
          options: dto.options,
          correct_answer: dto.correct_answer,
          explanation: dto.explanation,
          source_pages: dto.source_pages,
          order_index: dto.order_index ?? 0
        })
        .select('*')
        .single();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.addQuestion(quizId, dto);
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto): Promise<QuizQuestion> {
    try {
      const { data, error } = await this.supabase
        .from('quiz_questions')
        .update(dto)
        .eq('id', questionId)
        .select('*')
        .single();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.updateQuestion(questionId, dto);
  }

  async deleteQuestion(questionId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('quiz_questions').delete().eq('id', questionId);
      if (!error) return true;
    } catch (e) {}
    return this.fallback.deleteQuestion(questionId);
  }

  async reorderQuestions(quizId: string, questionIds: string[]): Promise<boolean> {
    try {
      const updates = questionIds.map((id, index) =>
        this.supabase.from('quiz_questions').update({ order_index: index }).eq('id', id)
      );
      await Promise.all(updates);
      return true;
    } catch (e) {}
    return this.fallback.reorderQuestions(quizId, questionIds);
  }

  async getShareConfig(quizId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    try {
      const quiz = await this.getQuizById(quizId, userId);
      if (quiz && quiz.share_token) {
        return {
          share_token: quiz.share_token,
          is_public: quiz.is_public ?? true,
          allow_cloning: quiz.allow_cloning ?? true
        };
      } else if (quiz) {
        const share_token = generateShareSlug();
        try {
          await this.supabase
            .from('quizzes')
            .update({ share_token, is_public: true, allow_cloning: true })
            .eq('id', quizId);
        } catch (e) {}
        return { share_token, is_public: true, allow_cloning: true };
      }
    } catch (e) {}
    return this.fallback.getShareConfig(quizId);
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    try {
      const updateData: Record<string, any> = {};
      if (dto.reset_token) {
        updateData.share_token = generateShareSlug();
      }
      if (dto.is_public !== undefined) {
        updateData.is_public = dto.is_public;
      }
      if (dto.allow_cloning !== undefined) {
        updateData.allow_cloning = dto.allow_cloning;
      }

      let query = this.supabase.from('quizzes').update(updateData).eq('id', quizId);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.select('*').single();
      if (!error && data) {
        return {
          share_token: data.share_token,
          is_public: data.is_public ?? true,
          allow_cloning: data.allow_cloning ?? true
        };
      }
    } catch (e) {}
    return this.fallback.updateShareConfig(quizId, dto);
  }

  async getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null> {
    try {
      const { data: quiz, error } = await this.supabase
        .from('quizzes')
        .select('*, subject:subjects(*)')
        .eq('share_token', shareToken)
        .maybeSingle();

      if (!error && quiz && quiz.is_public !== false) {
        const questions = await this.getQuestionsByQuizId(quiz.id);
        return {
          id: quiz.id,
          title: quiz.title,
          question_count: quiz.question_count || questions.length,
          generated_at: quiz.generated_at,
          source_model: quiz.source_model,
          share_token: quiz.share_token || shareToken,
          is_public: quiz.is_public ?? true,
          allow_cloning: quiz.allow_cloning ?? true,
          created_at: quiz.created_at,
          subject: quiz.subject ? { id: quiz.subject.id, name: quiz.subject.name, color: quiz.subject.color } : null,
          questions: questions.map(q => ({
            id: q.id,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation || null,
            order_index: q.order_index
          }))
        };
      }
    } catch (e) {}
    return this.fallback.getQuizByShareToken(shareToken);
  }

  async cloneQuizByShareToken(shareToken: string, userId?: string): Promise<Quiz> {
    const publicQuiz = await this.getQuizByShareToken(shareToken);
    if (!publicQuiz) throw new Error('Shared set not found or access is restricted.');
    if (!publicQuiz.allow_cloning) throw new Error('Creator has disabled cloning for this study set.');

    return await this.createQuiz({
      title: `${publicQuiz.title} (Copy)`,
      subject_id: publicQuiz.subject?.id || null,
      source_model: 'cloned',
      questions: publicQuiz.questions.map(q => ({
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null
      }))
    }, userId);
  }
}

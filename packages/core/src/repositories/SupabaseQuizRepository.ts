import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto } from '@quiz-creator/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { MemoryQuizRepository } from './MemoryQuizRepository';
import { normalizeQuestionFields } from './questionFields';

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
      if (userId) query = query.or(`user_id.eq.${userId},user_id.is.null`);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
    } catch (e) {}
    return this.fallback.listSubjects(userId);
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    try {
      const { data, error } = await this.supabase
        .from('subjects')
        .insert({
          name,
          color,
          user_id: userId,
          share_token: generateShareSlug(),
          is_public: true
        })
        .select('*')
        .single();
      if (!error && data) return data;
    } catch (e) {}
    return this.fallback.createSubject(name, color, userId);
  }

  async getSubjectShareConfig(subjectId: string, userId?: string): Promise<{ share_token: string; is_public: boolean }> {
    try {
      let query = this.supabase
        .from('subjects')
        .select('share_token, is_public')
        .eq('id', subjectId);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        if (data.share_token) {
          return {
            share_token: data.share_token,
            is_public: data.is_public ?? true
          };
        }

        const share_token = generateShareSlug();
        let updateQuery = this.supabase
          .from('subjects')
          .update({ share_token, is_public: true })
          .eq('id', subjectId);
        if (userId) updateQuery = updateQuery.eq('user_id', userId);
        const { data: updated, error: updateError } = await updateQuery
          .select('share_token, is_public')
          .single();
        if (!updateError && updated) {
          return {
            share_token: updated.share_token,
            is_public: updated.is_public ?? true
          };
        }
      }
    } catch (e) {}
    return this.fallback.getSubjectShareConfig(subjectId, userId);
  }

  async updateSubjectShareConfig(
    subjectId: string,
    dto: { is_public?: boolean; reset_token?: boolean },
    userId?: string
  ): Promise<{ share_token: string; is_public: boolean }> {
    try {
      const current = await this.getSubjectShareConfig(subjectId, userId);
      const updateData: Record<string, any> = {};
      if (dto.reset_token) updateData.share_token = generateShareSlug();
      if (dto.is_public !== undefined) updateData.is_public = dto.is_public;
      if (!updateData.share_token) updateData.share_token = current.share_token;

      let query = this.supabase.from('subjects').update(updateData).eq('id', subjectId);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.select('share_token, is_public').single();
      if (!error && data) {
        return {
          share_token: data.share_token,
          is_public: data.is_public ?? true
        };
      }
    } catch (e) {}
    return this.fallback.updateSubjectShareConfig(subjectId, dto, userId);
  }

  async getSubjectByShareToken(shareToken: string) {
    try {
      const { data: subject, error: subjectError } = await this.supabase
        .from('subjects')
        .select('id, name, color, share_token, is_public, created_at')
        .eq('share_token', shareToken)
        .maybeSingle();

      if (!subjectError && subject && subject.is_public !== false) {
        const { data: quizzes, error: quizzesError } = await this.supabase
          .from('quizzes')
          .select('id, title, description, question_count, generated_at, share_token, is_public, created_at')
          .eq('subject_id', subject.id)
          .order('generated_at', { ascending: false });

        if (!quizzesError) {
          return {
            id: subject.id,
            name: subject.name,
            color: subject.color,
            share_token: subject.share_token,
            is_public: subject.is_public ?? true,
            created_at: subject.created_at,
            quizzes: (quizzes || [])
              .filter((quiz: any) => quiz.is_public !== false && Boolean(quiz.share_token))
              .map((quiz: any) => ({
                id: quiz.id,
                title: quiz.title,
                description: quiz.description || null,
                question_count: quiz.question_count || 0,
                generated_at: quiz.generated_at,
                share_token: quiz.share_token,
                is_public: quiz.is_public ?? true,
                created_at: quiz.created_at
              }))
          };
        }
      }
    } catch (e) {}
    return this.fallback.getSubjectByShareToken(shareToken);
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
          description: dto.description || null,
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
          const rows = dto.questions.map((q, idx) => {
            const fields = normalizeQuestionFields(q);
            return {
              quiz_id: quizData.id,
              question_text: q.question_text,
              answer_text: fields.answer_text,
              question_type: fields.question_type,
              options: fields.options,
              correct_answer: fields.correct_answer,
              explanation: q.explanation,
              source_pages: q.source_pages,
              order_index: idx
            };
          });

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
    const fields = normalizeQuestionFields(dto);
    try {
      const { data, error } = await this.supabase
        .from('quiz_questions')
        .insert({
          quiz_id: quizId,
          question_text: dto.question_text,
          answer_text: fields.answer_text,
          question_type: fields.question_type,
          options: fields.options,
          correct_answer: fields.correct_answer,
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
      const { data: existing, error: existingError } = await this.supabase
        .from('quiz_questions')
        .select('*')
        .eq('id', questionId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw new Error('Question not found');

      const fields = normalizeQuestionFields(dto, existing as QuizQuestion);
      const updateData = {
        ...(dto.question_text !== undefined ? { question_text: dto.question_text } : {}),
        answer_text: fields.answer_text,
        question_type: fields.question_type,
        options: fields.options,
        correct_answer: fields.correct_answer,
        ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
        ...(dto.source_pages !== undefined ? { source_pages: dto.source_pages } : {})
      };
      const { data, error } = await this.supabase
        .from('quiz_questions')
        .update(updateData)
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
          description: quiz.description || null,
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
            answer_text: q.answer_text || q.options[q.correct_answer] || null,
            question_type: q.question_type || (q.options.length > 1 ? 'multiple_choice' : 'typed_answer'),
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

export class SupabaseQuizRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async listSubjects(userId) {
        let query = this.supabase.from('subjects').select('*').order('name');
        if (userId)
            query = query.eq('user_id', userId);
        const { data, error } = await query;
        if (error)
            throw error;
        return data || [];
    }
    async createSubject(name, color, userId) {
        const { data, error } = await this.supabase
            .from('subjects')
            .insert({ name, color, user_id: userId })
            .select('*')
            .single();
        if (error)
            throw error;
        return data;
    }
    async listQuizzes(userId) {
        let query = this.supabase
            .from('quizzes')
            .select('*, subject:subjects(*)')
            .order('generated_at', { ascending: false });
        if (userId)
            query = query.eq('user_id', userId);
        const { data, error } = await query;
        if (error)
            throw error;
        return data || [];
    }
    async getQuizById(id, userId) {
        let query = this.supabase
            .from('quizzes')
            .select('*, subject:subjects(*)')
            .eq('id', id);
        if (userId)
            query = query.eq('user_id', userId);
        const { data, error } = await query.maybeSingle();
        if (error)
            throw error;
        return data;
    }
    async createQuiz(dto, userId) {
        const { data: quizData, error: quizError } = await this.supabase
            .from('quizzes')
            .insert({
            title: dto.title,
            question_count: dto.questions.length,
            handout_name: dto.handout_name,
            source_model: dto.source_model || 'manual',
            subject_id: dto.subject_id,
            user_id: userId
        })
            .select('*')
            .single();
        if (quizError)
            throw quizError;
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
            const { error: qError } = await this.supabase.from('quiz_questions').insert(rows);
            if (qError)
                throw qError;
        }
        return quizData;
    }
    async updateQuiz(id, dto, userId) {
        let query = this.supabase.from('quizzes').update(dto).eq('id', id);
        if (userId)
            query = query.eq('user_id', userId);
        const { data, error } = await query.select('*').single();
        if (error)
            throw error;
        return data;
    }
    async deleteQuiz(id, userId) {
        let query = this.supabase.from('quizzes').delete().eq('id', id);
        if (userId)
            query = query.eq('user_id', userId);
        const { error } = await query;
        if (error)
            throw error;
        return true;
    }
    async getQuestionsByQuizId(quizId) {
        const { data, error } = await this.supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', quizId)
            .order('order_index', { ascending: true });
        if (error)
            throw error;
        return data || [];
    }
    async addQuestion(quizId, dto) {
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
        if (error)
            throw error;
        return data;
    }
    async updateQuestion(questionId, dto) {
        const { data, error } = await this.supabase
            .from('quiz_questions')
            .update(dto)
            .eq('id', questionId)
            .select('*')
            .single();
        if (error)
            throw error;
        return data;
    }
    async deleteQuestion(questionId) {
        const { error } = await this.supabase.from('quiz_questions').delete().eq('id', questionId);
        if (error)
            throw error;
        return true;
    }
    async reorderQuestions(quizId, questionIds) {
        const updates = questionIds.map((id, index) => this.supabase.from('quiz_questions').update({ order_index: index }).eq('id', id));
        await Promise.all(updates);
        return true;
    }
}

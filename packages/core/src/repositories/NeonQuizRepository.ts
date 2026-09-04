import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto } from '@quiz-creator/types';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { normalizeQuestionFields } from './questionFields';

function generateShareSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 10; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

export class NeonQuizRepository implements IQuizRepository {
  private sql: NeonQueryFunction<false, false>;

  constructor(clientOrUrl: string | NeonQueryFunction<false, false>) {
    if (typeof clientOrUrl === 'string') {
      this.sql = neon(clientOrUrl);
    } else {
      this.sql = clientOrUrl;
    }
  }

  async listSubjects(userId?: string): Promise<Subject[]> {
    if (userId) {
      const rows = await this.sql`
        SELECT * FROM subjects 
        WHERE user_id = ${userId} OR user_id IS NULL
        ORDER BY name ASC
      `;
      return rows as Subject[];
    }
    const rows = await this.sql`
      SELECT * FROM subjects 
      ORDER BY name ASC
    `;
    return rows as Subject[];
  }

  async createSubject(name: string, color: string, userId?: string): Promise<Subject> {
    const rows = await this.sql`
      INSERT INTO subjects (name, color, user_id, share_token, is_public)
      VALUES (${name}, ${color}, ${userId || null}, ${generateShareSlug()}, true)
      RETURNING *
    `;
    return rows[0] as Subject;
  }

  async getSubjectShareConfig(subjectId: string, userId?: string): Promise<{ share_token: string; is_public: boolean }> {
    const rows = userId
      ? await this.sql`SELECT share_token, is_public FROM subjects WHERE id = ${subjectId} AND user_id = ${userId} LIMIT 1`
      : await this.sql`SELECT share_token, is_public FROM subjects WHERE id = ${subjectId} LIMIT 1`;

    if (!rows || rows.length === 0) throw new Error(`Subject ${subjectId} not found`);
    const subject = rows[0] as any;

    if (subject.share_token) {
      return {
        share_token: subject.share_token,
        is_public: subject.is_public ?? true
      };
    }

    const share_token = generateShareSlug();
    const updatedRows = userId
      ? await this.sql`
          UPDATE subjects
          SET share_token = ${share_token}, is_public = true
          WHERE id = ${subjectId} AND user_id = ${userId}
          RETURNING share_token, is_public
        `
      : await this.sql`
          UPDATE subjects
          SET share_token = ${share_token}, is_public = true
          WHERE id = ${subjectId}
          RETURNING share_token, is_public
        `;

    if (!updatedRows || updatedRows.length === 0) throw new Error('Subject not found or update failed');
    return {
      share_token: updatedRows[0].share_token,
      is_public: updatedRows[0].is_public ?? true
    };
  }

  async updateSubjectShareConfig(
    subjectId: string,
    dto: { is_public?: boolean; reset_token?: boolean },
    userId?: string
  ): Promise<{ share_token: string; is_public: boolean }> {
    const current = await this.getSubjectShareConfig(subjectId, userId);
    const newShareToken = dto.reset_token ? generateShareSlug() : current.share_token;
    const isPublic = dto.is_public !== undefined ? dto.is_public : current.is_public;

    const rows = userId
      ? await this.sql`
          UPDATE subjects
          SET share_token = ${newShareToken}, is_public = ${isPublic}
          WHERE id = ${subjectId} AND user_id = ${userId}
          RETURNING share_token, is_public
        `
      : await this.sql`
          UPDATE subjects
          SET share_token = ${newShareToken}, is_public = ${isPublic}
          WHERE id = ${subjectId}
          RETURNING share_token, is_public
        `;

    if (!rows || rows.length === 0) throw new Error('Subject not found or update failed');
    return {
      share_token: rows[0].share_token,
      is_public: rows[0].is_public ?? true
    };
  }

  async getSubjectByShareToken(shareToken: string) {
    const subjectRows = await this.sql`
      SELECT id, name, color, share_token, is_public, created_at
      FROM subjects
      WHERE share_token = ${shareToken}
        AND COALESCE(is_public, TRUE) = TRUE
      LIMIT 1
    `;

    if (!subjectRows || subjectRows.length === 0) return null;
    const subject = subjectRows[0] as any;
    const quizRows = await this.sql`
      SELECT id, title, description, question_count, generated_at, share_token, is_public, created_at
      FROM quizzes
      WHERE subject_id = ${subject.id}
        AND COALESCE(is_public, TRUE) = TRUE
        AND share_token IS NOT NULL
      ORDER BY generated_at DESC
    `;

    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      share_token: subject.share_token,
      is_public: subject.is_public ?? true,
      created_at: subject.created_at,
      quizzes: (quizRows as any[]).map((quiz) => ({
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

  async listQuizzes(userId?: string): Promise<Quiz[]> {
    const rows = userId
      ? await this.sql`
          SELECT 
            q.*,
            CASE 
              WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id)
              ELSE NULL 
            END AS subject
          FROM quizzes q
          LEFT JOIN subjects s ON q.subject_id = s.id
          WHERE q.user_id = ${userId}
          ORDER BY q.generated_at DESC
        `
      : await this.sql`
          SELECT 
            q.*,
            CASE 
              WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id)
              ELSE NULL 
            END AS subject
          FROM quizzes q
          LEFT JOIN subjects s ON q.subject_id = s.id
          ORDER BY q.generated_at DESC
        `;
    return rows as Quiz[];
  }

  async listQuizzesAndSubjects(userId?: string): Promise<{ quizzes: Quiz[]; subjects: Subject[] }> {
    const [quizzes, subjects] = await Promise.all([
      this.listQuizzes(userId),
      this.listSubjects(userId)
    ]);
    return { quizzes, subjects };
  }

  async getQuizById(id: string, userId?: string): Promise<Quiz | null> {
    const rows = userId
      ? await this.sql`
          SELECT 
            q.*,
            CASE 
              WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id)
              ELSE NULL 
            END AS subject
          FROM quizzes q
          LEFT JOIN subjects s ON q.subject_id = s.id
          WHERE q.id = ${id} AND q.user_id = ${userId}
          LIMIT 1
        `
      : await this.sql`
          SELECT 
            q.*,
            CASE 
              WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'user_id', s.user_id)
              ELSE NULL 
            END AS subject
          FROM quizzes q
          LEFT JOIN subjects s ON q.subject_id = s.id
          WHERE q.id = ${id}
          LIMIT 1
        `;

    if (!rows || rows.length === 0) return null;
    return rows[0] as Quiz;
  }

  async createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz> {
    const quizRows = await this.sql`
      INSERT INTO quizzes (
        title,
        description,
        question_count,
        handout_name,
        source_model,
        subject_id,
        share_token,
        is_public,
        allow_cloning,
        user_id
      )
      VALUES (
        ${dto.title},
        ${dto.description || null},
        ${dto.questions.length},
        ${dto.handout_name || null},
        ${dto.source_model || 'manual'},
        ${dto.subject_id || null},
        ${generateShareSlug()},
        true,
        true,
        ${userId || null}
      )
      RETURNING *
    `;

    const createdQuiz = quizRows[0] as Quiz;

    for (let idx = 0; idx < dto.questions.length; idx++) {
      const q = dto.questions[idx];
      const fields = normalizeQuestionFields(q);
      const optionsJson = JSON.stringify(fields.options);
      const sourcePagesJson = q.source_pages ? JSON.stringify(q.source_pages) : null;
      const distractorExpJson = fields.distractor_explanations ? JSON.stringify(fields.distractor_explanations) : null;
      const discriminatoryKwJson = fields.discriminatory_keywords ? JSON.stringify(fields.discriminatory_keywords) : null;

      await this.sql`
        INSERT INTO quiz_questions (
          quiz_id,
          question_text,
          answer_text,
          question_type,
          options,
          correct_answer,
          explanation,
          correct_explanation,
          distractor_explanations,
          discriminatory_keywords,
          source_pages,
          order_index
        )
        VALUES (
          ${createdQuiz.id},
          ${q.question_text},
          ${fields.answer_text},
          ${fields.question_type},
          ${optionsJson}::jsonb,
          ${fields.correct_answer},
          ${q.explanation || null},
          ${fields.correct_explanation || null},
          ${distractorExpJson ? this.sql`${distractorExpJson}::jsonb` : null},
          ${discriminatoryKwJson ? this.sql`${discriminatoryKwJson}::jsonb` : null},
          ${sourcePagesJson ? this.sql`${sourcePagesJson}::jsonb` : null},
          ${idx}
        )
      `;
    }

    return createdQuiz;
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    const existing = await this.getQuizById(id, userId);
    if (!existing) throw new Error('Quiz not found');

    const rows = userId
      ? await this.sql`
          UPDATE quizzes
          SET title = ${dto.title !== undefined ? dto.title : existing.title},
              description = ${dto.description !== undefined ? dto.description : existing.description || null},
              subject_id = ${dto.subject_id !== undefined ? dto.subject_id : existing.subject_id || null}
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `
      : await this.sql`
          UPDATE quizzes
          SET title = ${dto.title !== undefined ? dto.title : existing.title},
              description = ${dto.description !== undefined ? dto.description : existing.description || null},
              subject_id = ${dto.subject_id !== undefined ? dto.subject_id : existing.subject_id || null}
          WHERE id = ${id}
          RETURNING *
        `;

    if (!rows || rows.length === 0) throw new Error('Quiz not found or update failed');
    return rows[0] as Quiz;
  }

  async deleteQuiz(id: string, userId?: string): Promise<boolean> {
    if (userId) {
      await this.sql`
        DELETE FROM quizzes 
        WHERE id = ${id} AND user_id = ${userId}
      `;
    } else {
      await this.sql`
        DELETE FROM quizzes 
        WHERE id = ${id}
      `;
    }
    return true;
  }

  async getQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    const rows = await this.sql`
      SELECT * FROM quiz_questions
      WHERE quiz_id = ${quizId}
      ORDER BY order_index ASC
    `;
    return rows as QuizQuestion[];
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto): Promise<QuizQuestion> {
    const fields = normalizeQuestionFields(dto);
    const optionsJson = JSON.stringify(fields.options);
    const sourcePagesJson = dto.source_pages ? JSON.stringify(dto.source_pages) : null;
    const distractorExpJson = fields.distractor_explanations ? JSON.stringify(fields.distractor_explanations) : null;
    const discriminatoryKwJson = fields.discriminatory_keywords ? JSON.stringify(fields.discriminatory_keywords) : null;

    const rows = await this.sql`
      INSERT INTO quiz_questions (
        quiz_id,
        question_text,
        answer_text,
        question_type,
        options,
        correct_answer,
        explanation,
        correct_explanation,
        distractor_explanations,
        discriminatory_keywords,
        source_pages,
        order_index
      )
      VALUES (
        ${quizId},
        ${dto.question_text},
        ${fields.answer_text},
        ${fields.question_type},
        ${optionsJson}::jsonb,
        ${fields.correct_answer},
        ${dto.explanation || null},
        ${fields.correct_explanation || null},
        ${distractorExpJson ? this.sql`${distractorExpJson}::jsonb` : null},
        ${discriminatoryKwJson ? this.sql`${discriminatoryKwJson}::jsonb` : null},
        ${sourcePagesJson ? this.sql`${sourcePagesJson}::jsonb` : null},
        ${dto.order_index ?? 0}
      )
      RETURNING *
    `;

    // Increment question count in parent quiz
    await this.sql`
      UPDATE quizzes 
      SET question_count = question_count + 1
      WHERE id = ${quizId}
    `;

    return rows[0] as QuizQuestion;
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto): Promise<QuizQuestion> {
    const existingRows = await this.sql`SELECT * FROM quiz_questions WHERE id = ${questionId} LIMIT 1`;
    if (!existingRows || existingRows.length === 0) throw new Error('Question not found');
    const curr = existingRows[0] as QuizQuestion;
    const fields = normalizeQuestionFields(dto, curr);
    const optionsJson = JSON.stringify(fields.options);
    const questionText = dto.question_text !== undefined ? dto.question_text : curr.question_text;
    const explanation = dto.explanation !== undefined ? dto.explanation : curr.explanation;
    const sourcePagesJson = dto.source_pages !== undefined
      ? (dto.source_pages ? JSON.stringify(dto.source_pages) : null)
      : (curr.source_pages ? JSON.stringify(curr.source_pages) : null);
    const distractorExpJson = fields.distractor_explanations !== null
      ? JSON.stringify(fields.distractor_explanations)
      : null;
    const discriminatoryKwJson = fields.discriminatory_keywords !== null
      ? JSON.stringify(fields.discriminatory_keywords)
      : null;

    const rows = await this.sql`
      UPDATE quiz_questions
      SET
        question_text = ${questionText},
        answer_text = ${fields.answer_text},
        question_type = ${fields.question_type},
        options = ${optionsJson}::jsonb,
        correct_answer = ${fields.correct_answer},
        explanation = ${explanation},
        correct_explanation = ${fields.correct_explanation || null},
        distractor_explanations = ${distractorExpJson ? this.sql`${distractorExpJson}::jsonb` : null},
        discriminatory_keywords = ${discriminatoryKwJson ? this.sql`${discriminatoryKwJson}::jsonb` : null},
        source_pages = ${sourcePagesJson ? this.sql`${sourcePagesJson}::jsonb` : null}
      WHERE id = ${questionId}
      RETURNING *
    `;

    return rows[0] as QuizQuestion;
  }

  async deleteQuestion(questionId: string): Promise<boolean> {
    const rows = await this.sql`
      DELETE FROM quiz_questions
      WHERE id = ${questionId}
      RETURNING quiz_id
    `;
    if (rows && rows.length > 0) {
      const quizId = rows[0].quiz_id;
      await this.sql`
        UPDATE quizzes 
        SET question_count = GREATEST(question_count - 1, 0)
        WHERE id = ${quizId}
      `;
    }
    return true;
  }

  async reorderQuestions(quizId: string, questionIds: string[]): Promise<boolean> {
    for (let index = 0; index < questionIds.length; index++) {
      const id = questionIds[index];
      await this.sql`
        UPDATE quiz_questions 
        SET order_index = ${index}
        WHERE id = ${id} AND quiz_id = ${quizId}
      `;
    }
    return true;
  }

  async getShareConfig(quizId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    const rows = userId
      ? await this.sql`SELECT share_token, is_public, allow_cloning FROM quizzes WHERE id = ${quizId} AND user_id = ${userId} LIMIT 1`
      : await this.sql`SELECT share_token, is_public, allow_cloning FROM quizzes WHERE id = ${quizId} LIMIT 1`;

    if (!rows || rows.length === 0) throw new Error(`Quiz ${quizId} not found`);
    const quiz = rows[0] as any;

    if (quiz.share_token) {
      return {
        share_token: quiz.share_token,
        is_public: quiz.is_public ?? true,
        allow_cloning: quiz.allow_cloning ?? true
      };
    }

    const share_token = generateShareSlug();
    await this.sql`
      UPDATE quizzes
      SET share_token = ${share_token}, is_public = true, allow_cloning = true
      WHERE id = ${quizId}
    `;

    return {
      share_token,
      is_public: true,
      allow_cloning: true
    };
  }

  async updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }> {
    const current = await this.getShareConfig(quizId, userId);
    const newShareToken = dto.reset_token ? generateShareSlug() : current.share_token;
    const isPublic = dto.is_public !== undefined ? dto.is_public : current.is_public;
    const allowCloning = dto.allow_cloning !== undefined ? dto.allow_cloning : current.allow_cloning;

    const rows = userId
      ? await this.sql`
          UPDATE quizzes
          SET share_token = ${newShareToken}, is_public = ${isPublic}, allow_cloning = ${allowCloning}
          WHERE id = ${quizId} AND user_id = ${userId}
          RETURNING share_token, is_public, allow_cloning
        `
      : await this.sql`
          UPDATE quizzes
          SET share_token = ${newShareToken}, is_public = ${isPublic}, allow_cloning = ${allowCloning}
          WHERE id = ${quizId}
          RETURNING share_token, is_public, allow_cloning
        `;

    if (!rows || rows.length === 0) throw new Error('Quiz not found or update failed');
    return {
      share_token: rows[0].share_token,
      is_public: rows[0].is_public ?? true,
      allow_cloning: rows[0].allow_cloning ?? true
    };
  }

  async getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null> {
    const rows = await this.sql`
      SELECT 
        q.*,
        CASE 
          WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'name', s.name, 'color', s.color)
          ELSE NULL 
        END AS subject
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE q.share_token = ${shareToken}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) return null;
    const quiz = rows[0] as any;
    if (quiz.is_public === false) return null;

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
        correct_explanation: q.correct_explanation || null,
        distractor_explanations: q.distractor_explanations || null,
        discriminatory_keywords: q.discriminatory_keywords || null,
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
        explanation: q.explanation || null,
        correct_explanation: q.correct_explanation || null,
        distractor_explanations: q.distractor_explanations || null,
        discriminatory_keywords: q.discriminatory_keywords || null
      }))
    }, userId);
  }
}

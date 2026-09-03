import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto } from '@quiz-creator/types';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

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
        WHERE user_id = ${userId} 
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
      INSERT INTO subjects (name, color, user_id)
      VALUES (${name}, ${color}, ${userId || null})
      RETURNING *
    `;
    return rows[0] as Subject;
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
        question_count, 
        handout_name, 
        source_model, 
        subject_id, 
        user_id
      )
      VALUES (
        ${dto.title}, 
        ${dto.questions.length}, 
        ${dto.handout_name || null}, 
        ${dto.source_model || 'manual'}, 
        ${dto.subject_id || null}, 
        ${userId || null}
      )
      RETURNING *
    `;

    const createdQuiz = quizRows[0] as Quiz;

    if (dto.questions.length > 0) {
      for (let idx = 0; idx < dto.questions.length; idx++) {
        const q = dto.questions[idx];
        const optionsJson = JSON.stringify(q.options || []);
        const sourcePagesJson = q.source_pages ? JSON.stringify(q.source_pages) : null;
        
        await this.sql`
          INSERT INTO quiz_questions (
            quiz_id, 
            question_text, 
            options, 
            correct_answer, 
            explanation, 
            source_pages, 
            order_index
          )
          VALUES (
            ${createdQuiz.id}, 
            ${q.question_text}, 
            ${optionsJson}::jsonb, 
            ${q.correct_answer}, 
            ${q.explanation || null}, 
            ${sourcePagesJson ? this.sql`${sourcePagesJson}::jsonb` : null}, 
            ${idx}
          )
        `;
      }
    }

    return createdQuiz;
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz> {
    const titleVal = dto.title !== undefined ? dto.title : null;
    const subjectIdVal = dto.subject_id !== undefined ? dto.subject_id : null;

    let rows: any[];
    if (dto.title !== undefined && dto.subject_id !== undefined) {
      rows = userId
        ? await this.sql`
            UPDATE quizzes
            SET title = ${titleVal}, subject_id = ${subjectIdVal}
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *
          `
        : await this.sql`
            UPDATE quizzes
            SET title = ${titleVal}, subject_id = ${subjectIdVal}
            WHERE id = ${id}
            RETURNING *
          `;
    } else if (dto.title !== undefined) {
      rows = userId
        ? await this.sql`
            UPDATE quizzes
            SET title = ${titleVal}
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *
          `
        : await this.sql`
            UPDATE quizzes
            SET title = ${titleVal}
            WHERE id = ${id}
            RETURNING *
          `;
    } else if (dto.subject_id !== undefined) {
      rows = userId
        ? await this.sql`
            UPDATE quizzes
            SET subject_id = ${subjectIdVal}
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *
          `
        : await this.sql`
            UPDATE quizzes
            SET subject_id = ${subjectIdVal}
            WHERE id = ${id}
            RETURNING *
          `;
    } else {
      const existing = await this.getQuizById(id, userId);
      if (!existing) throw new Error('Quiz not found');
      return existing;
    }

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
    const optionsJson = JSON.stringify(dto.options || []);
    const sourcePagesJson = dto.source_pages ? JSON.stringify(dto.source_pages) : null;

    const rows = await this.sql`
      INSERT INTO quiz_questions (
        quiz_id,
        question_text,
        options,
        correct_answer,
        explanation,
        source_pages,
        order_index
      )
      VALUES (
        ${quizId},
        ${dto.question_text},
        ${optionsJson}::jsonb,
        ${dto.correct_answer},
        ${dto.explanation || null},
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
    const fieldsToUpdate: string[] = [];

    // Check existing
    const existingRows = await this.sql`SELECT * FROM quiz_questions WHERE id = ${questionId} LIMIT 1`;
    if (!existingRows || existingRows.length === 0) throw new Error('Question not found');
    const curr = existingRows[0];

    const questionText = dto.question_text !== undefined ? dto.question_text : curr.question_text;
    const optionsJson = dto.options !== undefined ? JSON.stringify(dto.options) : JSON.stringify(curr.options);
    const correctAnswer = dto.correct_answer !== undefined ? dto.correct_answer : curr.correct_answer;
    const explanation = dto.explanation !== undefined ? dto.explanation : curr.explanation;
    const sourcePagesJson = dto.source_pages !== undefined ? (dto.source_pages ? JSON.stringify(dto.source_pages) : null) : (curr.source_pages ? JSON.stringify(curr.source_pages) : null);

    const rows = await this.sql`
      UPDATE quiz_questions
      SET 
        question_text = ${questionText},
        options = ${optionsJson}::jsonb,
        correct_answer = ${correctAnswer},
        explanation = ${explanation},
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

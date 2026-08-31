import { IQuizRepository } from './IQuizRepository';
import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject } from '@quiz-creator/types';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

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
}

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import type {
  CreateReviewerGenerationJobInput,
  CreateSourceDocumentInput,
  GeneratedReviewerItem,
  ParsedPage,
  ReviewerGenerationJob,
  ReviewerSet,
  SourceChunk,
  SourceDocument
} from '@quiz-creator/types';
import type { ReviewerGenerationRepository, ReviewerPublicationInput, ReviewerPublicationResult, StoredSourceContent } from './IReviewerGenerationRepository';
import { generateSecureToken } from '../security/shareTokens';
import { slugify } from '../utils/slug';

const LEASE_MINUTES = 10;

type Row = Record<string, any>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function iso(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value as null | undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toSourceDocument(row: Row): SourceDocument {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    originalFilename: String(row.original_filename),
    storagePath: String(row.storage_path),
    mimeType: String(row.mime_type),
    fileSizeBytes: Number(row.file_size_bytes),
    contentHash: String(row.content_hash),
    pageCount: row.page_count === null || row.page_count === undefined ? null : Number(row.page_count),
    parseStatus: row.parse_status,
    pdfDataBase64: String(row.pdf_data_base64),
    createdAt: iso(row.created_at) || new Date().toISOString(),
    parsedAt: iso(row.parsed_at)
  };
}

function toJob(row: Row): ReviewerGenerationJob {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    reviewerSetId: String(row.reviewer_set_id),
    requestedBy: String(row.requested_by),
    options: parseJson(row.generation_options_json, {
      questionTypes: ['multiple_choice'],
      difficulty: 'mixed',
      questionCount: 10
    }),
    status: row.status,
    stage: row.stage || null,
    progressPercent: Number(row.progress_percent || 0),
    message: row.message || null,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    attemptCount: Number(row.attempt_count || 0),
    createdAt: iso(row.created_at) || new Date().toISOString(),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    leaseExpiresAt: iso(row.lease_expires_at),
    nextAttemptAt: iso(row.next_attempt_at),
    quizId: row.quiz_id ? String(row.quiz_id) : null
  };
}

function toReviewerSet(row: Row): ReviewerSet {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    sourceDocumentId: String(row.source_document_id),
    title: String(row.title),
    generationOptions: parseJson(row.generation_options_json, {
      questionTypes: ['multiple_choice'],
      difficulty: 'mixed',
      questionCount: 10
    }),
    status: row.status,
    quizId: row.quiz_id ? String(row.quiz_id) : null,
    createdAt: iso(row.created_at) || new Date().toISOString(),
    publishedAt: iso(row.published_at)
  };
}

export class NeonReviewerGenerationRepository implements ReviewerGenerationRepository {
  private readonly sql: NeonQueryFunction<false, false>;

  constructor(clientOrUrl: string | NeonQueryFunction<false, false>) {
    this.sql = typeof clientOrUrl === 'string' ? neon(clientOrUrl) : clientOrUrl;
  }

  async createSourceDocument(input: CreateSourceDocumentInput): Promise<SourceDocument> {
    const existing = await this.sql`
      SELECT * FROM source_documents
      WHERE owner_id = ${input.ownerId} AND content_hash = ${input.contentHash}
      LIMIT 1
    `;
    if (existing.length > 0) return toSourceDocument(existing[0] as Row);

    const rows = await this.sql`
      INSERT INTO source_documents (
        owner_id, original_filename, storage_path, mime_type,
        file_size_bytes, content_hash, parse_status, pdf_data_base64
      )
      VALUES (
        ${input.ownerId}, ${input.originalFilename},
        ${`database://source-documents/${input.contentHash}`}, ${input.mimeType},
        ${input.fileSizeBytes}, ${input.contentHash}, 'pending', ${input.pdfDataBase64}
      )
      ON CONFLICT (owner_id, content_hash) DO UPDATE
        SET original_filename = source_documents.original_filename
      RETURNING *
    `;
    return toSourceDocument(rows[0] as Row);
  }

  async getSourceDocument(documentId: string, ownerId?: string): Promise<SourceDocument | null> {
    const rows = ownerId
      ? await this.sql`SELECT * FROM source_documents WHERE id = ${documentId} AND owner_id = ${ownerId} LIMIT 1`
      : await this.sql`SELECT * FROM source_documents WHERE id = ${documentId} LIMIT 1`;
    return rows.length > 0 ? toSourceDocument(rows[0] as Row) : null;
  }

  async saveParsedContent(documentId: string, pages: ParsedPage[], chunks: SourceChunk[]): Promise<void> {
    await this.sql`
      UPDATE source_documents
      SET parse_status = 'parsing', page_count = ${pages.length}, parsed_at = NULL
      WHERE id = ${documentId}
    `;
    await this.sql`DELETE FROM source_document_pages WHERE document_id = ${documentId}`;
    await this.sql`DELETE FROM source_document_chunks WHERE document_id = ${documentId}`;

    for (const page of pages) {
      await this.sql`
        INSERT INTO source_document_pages (
          document_id, page_number, content, headings, tables, image_references,
          extraction_method, parser_version, source_document_hash, content_hash
        ) VALUES (
          ${documentId}, ${page.pageNumber}, ${page.text},
          ${JSON.stringify(page.headings)}::jsonb,
          ${JSON.stringify(page.tables || [])}::jsonb,
          ${JSON.stringify(page.imageReferences || [])}::jsonb,
          ${page.extractionMethod}, ${page.parserVersion},
          ${page.sourceDocumentHash}, ${page.contentHash}
        )
      `;
    }
    for (const chunk of chunks) {
      await this.sql`
        INSERT INTO source_document_chunks (
          document_id, page_start, page_end, section_title, content, content_hash, token_count
        ) VALUES (
          ${documentId}, ${chunk.pageStart}, ${chunk.pageEnd}, ${chunk.sectionTitle || null},
          ${chunk.content}, ${chunk.contentHash}, ${chunk.tokenCount}
        )
      `;
    }
    await this.sql`
      UPDATE source_documents
      SET parse_status = 'parsed', page_count = ${pages.length}, parsed_at = now()
      WHERE id = ${documentId}
    `;
  }

  async markSourceDocumentParseFailed(documentId: string): Promise<void> {
    await this.sql`
      UPDATE source_documents
      SET parse_status = 'failed'
      WHERE id = ${documentId}
    `;
  }

  async getStoredSourceContent(documentId: string): Promise<StoredSourceContent> {
    const [pageRows, chunkRows] = await Promise.all([
      this.sql`SELECT * FROM source_document_pages WHERE document_id = ${documentId} ORDER BY page_number ASC`,
      this.sql`SELECT * FROM source_document_chunks WHERE document_id = ${documentId} ORDER BY page_start ASC, id ASC`
    ]);
    return {
      pages: (pageRows as Row[]).map((row) => ({
        pageNumber: Number(row.page_number),
        text: String(row.content),
        headings: parseJson(row.headings, []),
        tables: parseJson(row.tables, []),
        imageReferences: parseJson(row.image_references, []),
        extractionMethod: row.extraction_method,
        parserVersion: String(row.parser_version),
        sourceDocumentHash: String(row.source_document_hash),
        contentHash: String(row.content_hash)
      })),
      chunks: (chunkRows as Row[]).map((row) => ({
        chunkId: String(row.id),
        documentId,
        sectionTitle: row.section_title || undefined,
        pageStart: Number(row.page_start),
        pageEnd: Number(row.page_end),
        content: String(row.content),
        contentHash: String(row.content_hash),
        tokenCount: Number(row.token_count)
      }))
    };
  }

  async getReviewerSet(reviewerSetId: string): Promise<ReviewerSet | null> {
    const rows = await this.sql`SELECT * FROM reviewer_sets WHERE id = ${reviewerSetId} LIMIT 1`;
    return rows.length > 0 ? toReviewerSet(rows[0] as Row) : null;
  }
  async findActiveJob(documentId: string, requestedBy: string): Promise<ReviewerGenerationJob | null> {
    const rows = await this.sql`
      SELECT * FROM reviewer_generation_jobs
      WHERE document_id = ${documentId}
        AND requested_by = ${requestedBy}
        AND status NOT IN ('published', 'failed')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows.length > 0 ? toJob(rows[0] as Row) : null;
  }

  async findJobByIdempotencyKey(requestedBy: string, idempotencyKey: string): Promise<ReviewerGenerationJob | null> {
    const rows = await this.sql`
      SELECT * FROM reviewer_generation_jobs
      WHERE requested_by = ${requestedBy} AND idempotency_key = ${idempotencyKey}
      LIMIT 1
    `;
    return rows.length > 0 ? toJob(rows[0] as Row) : null;
  }

  async createGenerationJob(input: CreateReviewerGenerationJobInput): Promise<ReviewerGenerationJob> {
    const existing = input.options.idempotencyKey
      ? await this.findJobByIdempotencyKey(input.requestedBy, input.options.idempotencyKey)
      : null;
    if (existing) return existing;

    const title = input.options.title?.trim() || 'Generated Handout Reviewer';
    const rows = await this.sql`
      WITH created_set AS (
        INSERT INTO reviewer_sets (owner_id, source_document_id, title, generation_options_json, status)
        VALUES (
          ${input.requestedBy}, ${input.documentId}, ${title},
          ${JSON.stringify(input.options)}::jsonb, 'generating'
        )
        RETURNING id
      )
      INSERT INTO reviewer_generation_jobs (
        document_id, reviewer_set_id, requested_by, generation_options_json,
        status, stage, progress_percent, message, idempotency_key
      )
      SELECT ${input.documentId}, id, ${input.requestedBy}, ${JSON.stringify(input.options)}::jsonb,
        'queued', 'parsing', 0, 'Queued for generation', ${input.options.idempotencyKey || null}
      FROM created_set
      ON CONFLICT (requested_by, idempotency_key) DO NOTHING
      RETURNING *
    `;

    if (rows.length > 0) return toJob(rows[0] as Row);
    if (input.options.idempotencyKey) {
      const retry = await this.findJobByIdempotencyKey(input.requestedBy, input.options.idempotencyKey);
      if (retry) return retry;
    }
    throw new Error('Unable to create reviewer generation job');
  }

  async getJob(jobId: string, requestedBy?: string): Promise<ReviewerGenerationJob | null> {
    const rows = requestedBy
      ? await this.sql`SELECT * FROM reviewer_generation_jobs WHERE id = ${jobId} AND requested_by = ${requestedBy} LIMIT 1`
      : await this.sql`SELECT * FROM reviewer_generation_jobs WHERE id = ${jobId} LIMIT 1`;
    return rows.length > 0 ? toJob(rows[0] as Row) : null;
  }

  async claimJob(jobId: string): Promise<ReviewerGenerationJob | null> {
    const rows = await this.sql`
      UPDATE reviewer_generation_jobs
      SET status = 'parsing', stage = 'parsing', progress_percent = GREATEST(progress_percent, 1),
          message = 'Parsing source document', attempt_count = attempt_count + 1,
          started_at = COALESCE(started_at, now()),
          lease_expires_at = now() + (${LEASE_MINUTES} * INTERVAL '1 minute'),
          next_attempt_at = NULL
      WHERE id = ${jobId}
        AND (
          (status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
          OR (status NOT IN ('published', 'failed') AND lease_expires_at < now())
        )
      RETURNING *
    `;
    return rows.length > 0 ? toJob(rows[0] as Row) : null;
  }

  async claimNextJob(): Promise<ReviewerGenerationJob | null> {
    const rows = await this.sql`
      WITH candidate AS (
        SELECT id FROM reviewer_generation_jobs
        WHERE (status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
           OR (status NOT IN ('published', 'failed') AND lease_expires_at < now())
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE reviewer_generation_jobs AS job
      SET status = 'parsing', stage = 'parsing', progress_percent = GREATEST(job.progress_percent, 1),
          message = 'Parsing source document', attempt_count = job.attempt_count + 1,
          started_at = COALESCE(job.started_at, now()),
          lease_expires_at = now() + (${LEASE_MINUTES} * INTERVAL '1 minute'),
          next_attempt_at = NULL
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING job.*
    `;
    return rows.length > 0 ? toJob(rows[0] as Row) : null;
  }

  async updateJob(jobId: string, update: Partial<Pick<ReviewerGenerationJob, 'status' | 'stage' | 'progressPercent' | 'message' | 'errorCode' | 'errorMessage' | 'quizId' | 'nextAttemptAt'>>): Promise<void> {
    await this.sql`
      UPDATE reviewer_generation_jobs
      SET status = COALESCE(${update.status || null}, status),
          stage = COALESCE(${update.stage || null}, stage),
          progress_percent = COALESCE(${update.progressPercent ?? null}, progress_percent),
          message = COALESCE(${update.message ?? null}, message),
          error_code = COALESCE(${update.errorCode ?? null}, error_code),
          error_message = COALESCE(${update.errorMessage ?? null}, error_message),
          quiz_id = COALESCE(${update.quizId ?? null}, quiz_id),
          completed_at = CASE WHEN ${update.status === 'published'} THEN now() ELSE completed_at END,
          lease_expires_at = CASE
            WHEN ${update.status === 'published' || update.status === 'failed'} THEN NULL
            ELSE now() + (${LEASE_MINUTES} * INTERVAL '1 minute')
          END,
          next_attempt_at = CASE
            WHEN ${update.status === 'queued'} THEN ${update.nextAttemptAt ?? null}
            WHEN ${update.status !== undefined} THEN NULL
            ELSE next_attempt_at
          END
      WHERE id = ${jobId}
    `;
  }

  async saveReviewerItems(reviewerSetId: string, items: GeneratedReviewerItem[]): Promise<void> {
    await this.sql`DELETE FROM reviewer_items WHERE reviewer_set_id = ${reviewerSetId}`;
    for (const [index, item] of items.entries()) {
      await this.sql`
        INSERT INTO reviewer_items (
          reviewer_set_id, question_type, question, answer, explanation, options_json,
          difficulty, source_page_start, source_page_end, evidence_excerpt, display_order
        ) VALUES (
          ${reviewerSetId}, ${item.questionType}, ${item.question}, ${item.answer},
          ${item.explanation || null}, ${JSON.stringify(item.options || [])}::jsonb,
          ${item.difficulty}, ${item.sourcePageStart}, ${item.sourcePageEnd},
          ${item.evidenceExcerpt}, ${index}
        )
      `;
    }
  }

  async publishReviewerSetWithQuiz(input: ReviewerPublicationInput): Promise<ReviewerPublicationResult | null> {
    const quizSlug = `${slugify(input.quiz.title, 'quiz')}-${randomUUID().slice(0, 8)}`;
    const shareToken = generateSecureToken(32);
    const questionPayload = JSON.stringify(input.quiz.questions);
    const itemPayload = JSON.stringify(input.items.map((item, displayOrder) => ({
      question_type: item.questionType,
      question: item.question,
      answer: item.answer,
      explanation: item.explanation || null,
      options_json: item.options || [],
      difficulty: item.difficulty,
      source_page_start: item.sourcePageStart,
      source_page_end: item.sourcePageEnd,
      evidence_excerpt: item.evidenceExcerpt,
      display_order: displayOrder
    })));

    const rows = await this.sql`
      WITH eligible AS (
        SELECT job.id AS job_id, job.reviewer_set_id, job.requested_by
        FROM reviewer_generation_jobs AS job
        JOIN reviewer_sets AS reviewer_set ON reviewer_set.id = job.reviewer_set_id
        WHERE job.id = ${input.jobId}
          AND job.reviewer_set_id = ${input.reviewerSetId}
          AND job.status NOT IN ('published', 'failed')
          AND reviewer_set.status = 'generating'
        FOR UPDATE OF job, reviewer_set
      ),
      created_quiz AS (
        INSERT INTO quizzes (
          title, slug, question_count, handout_name, source_model,
          subject_id, share_token, is_public, allow_cloning, user_id
        )
        SELECT
          ${input.quiz.title}, ${quizSlug}, ${input.quiz.questions.length},
          ${input.quiz.handoutName}, ${input.quiz.sourceModel},
          ${input.quiz.subjectId || null}, ${shareToken}, true, true, ${input.ownerId}
        FROM eligible
        RETURNING id
      ),
      created_questions AS (
        INSERT INTO quiz_questions (
          quiz_id, question_text, answer_text, question_type, options,
          correct_answer, explanation, source_pages, order_index
        )
        SELECT
          created_quiz.id, question.question_text, question.answer_text,
          question.question_type, question.options, question.correct_answer,
          question.explanation, question.source_pages, question.order_index
        FROM created_quiz
        CROSS JOIN LATERAL jsonb_to_recordset(${questionPayload}::jsonb) AS question(
          question_text text,
          answer_text text,
          question_type text,
          options jsonb,
          correct_answer integer,
          explanation text,
          source_pages jsonb,
          order_index integer
        )
        RETURNING quiz_id
      ),
      created_items AS (
        INSERT INTO reviewer_items (
          reviewer_set_id, question_type, question, answer, explanation, options_json,
          difficulty, source_page_start, source_page_end, evidence_excerpt, display_order
        )
        SELECT
          ${input.reviewerSetId}, item.question_type, item.question, item.answer,
          item.explanation, item.options_json, item.difficulty,
          item.source_page_start, item.source_page_end, item.evidence_excerpt,
          item.display_order
        FROM eligible
        CROSS JOIN LATERAL jsonb_to_recordset(${itemPayload}::jsonb) AS item(
          question_type text,
          question text,
          answer text,
          explanation text,
          options_json jsonb,
          difficulty text,
          source_page_start integer,
          source_page_end integer,
          evidence_excerpt text,
          display_order integer
        )
        RETURNING reviewer_set_id
      ),
      published_set AS (
        UPDATE reviewer_sets
        SET status = 'available', quiz_id = created_quiz.id, published_at = now()
        FROM created_quiz
        WHERE reviewer_sets.id = ${input.reviewerSetId}
          AND EXISTS (SELECT 1 FROM created_questions)
          AND EXISTS (SELECT 1 FROM created_items)
        RETURNING reviewer_sets.*
      ),
      published_job AS (
        UPDATE reviewer_generation_jobs
        SET status = 'published', stage = NULL, progress_percent = 100,
            message = 'Reviewer set published', error_code = NULL, error_message = NULL,
            completed_at = now(), lease_expires_at = NULL, quiz_id = created_quiz.id
        FROM created_quiz, published_set
        WHERE reviewer_generation_jobs.id = ${input.jobId}
          AND reviewer_generation_jobs.reviewer_set_id = ${input.reviewerSetId}
        RETURNING reviewer_generation_jobs.id
      )
      SELECT published_set.*, created_quiz.id AS quiz_id
      FROM published_set
      CROSS JOIN created_quiz
      CROSS JOIN published_job
    `;

    if (rows.length === 0) return null;
    const row = rows[0] as Row;
    return { reviewerSet: toReviewerSet(row), quizId: String(row.quiz_id) };
  }

  async publishReviewerSet(reviewerSetId: string, quizId: string): Promise<ReviewerSet | null> {
    const rows = await this.sql`
      UPDATE reviewer_sets
      SET status = 'available', quiz_id = ${quizId}, published_at = now()
      WHERE id = ${reviewerSetId}
      RETURNING *
    `;
    if (rows.length === 0) return null;
    const row = rows[0] as Row;
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      sourceDocumentId: String(row.source_document_id),
      title: String(row.title),
      generationOptions: parseJson(row.generation_options_json, {
        questionTypes: ['multiple_choice'],
        difficulty: 'mixed',
        questionCount: 10
      }),
      status: row.status,
      quizId: row.quiz_id ? String(row.quiz_id) : null,
      createdAt: iso(row.created_at) || new Date().toISOString(),
      publishedAt: iso(row.published_at)
    };
  }

  async markReviewerSetFailed(reviewerSetId: string): Promise<void> {
    await this.sql`
      UPDATE reviewer_sets SET status = 'failed' WHERE id = ${reviewerSetId}
    `;
  }
}

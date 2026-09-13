import { createHash, randomUUID } from 'node:crypto';
import { after, NextRequest, NextResponse } from 'next/server';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import { parseReviewerGenerationRequest } from '@/lib/request-validation';
import { assertAllowedOrigin, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import { getReviewerGenerationRepository } from '@/lib/reviewer-generation-repository';
import { processReviewerGenerationJob } from '@/lib/reviewer-generation-worker';
import type { ReviewerGenerationOptions } from '@quiz-creator/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    assertAllowedOrigin(req);
    const requestedBy = await getAnonymousUserId(req);
    const rateLimit = await enforceRateLimit(req, 'reviewer-generation', requestedBy, 5, 60 * 60 * 1000);
    if (rateLimit) return rateLimit;

    const { documentId } = await context.params;
    const repository = getReviewerGenerationRepository();
    const document = await repository.getSourceDocument(documentId, requestedBy);
    if (!document) return NextResponse.json({ error: 'Source document not found or access is restricted' }, { status: 404 });
    if (document.fileSizeBytes > SECURITY_LIMITS.documentBytes) {
      throw new RequestSecurityError(413, 'Source document is too large for generation');
    }

    const parsed = parseReviewerGenerationRequest(await readJsonBody(req, 32 * 1024)) as ReviewerGenerationOptions;
    if (parsed.subjectId) {
      const subjectAccess = await (await getQuizRepository(false)).getSubjectAccess(parsed.subjectId, requestedBy);
      if (!subjectAccess?.can_edit_reviewers) {
        return NextResponse.json({ error: 'Subject not found or access is restricted' }, { status: 403 });
      }
    }

    const clientIdempotencyKey = parsed.idempotencyKey || randomUUID();
    const requestIdentity = JSON.stringify({
      documentId,
      clientIdempotencyKey,
      title: parsed.title || null,
      subjectId: parsed.subjectId || null,
      questionTypes: [...parsed.questionTypes].sort(),
      difficulty: parsed.difficulty,
      questionCount: parsed.questionCount
    });
    const baseIdempotencyKey = `reviewer-${createHash('sha256').update(requestIdentity).digest('hex')}`;
    const existingByKey = await repository.findJobByIdempotencyKey(requestedBy, baseIdempotencyKey);
    const existingActive = existingByKey && existingByKey.status !== 'failed'
      ? existingByKey
      : (!parsed.idempotencyKey ? await repository.findActiveJob(documentId, requestedBy) : null);
    if (existingActive) {
      return NextResponse.json({
        jobId: existingActive.id,
        reviewerSetId: existingActive.reviewerSetId,
        status: existingActive.status
      }, { status: 202 });
    }

    // A failed job is terminal and must not permanently consume the client's
    // deterministic key. Keep the original key for active/published idempotency,
    // but create a fresh key for an explicit retry of the same document.
    const idempotencyKey = existingByKey?.status === 'failed'
      ? `${baseIdempotencyKey}-retry-${randomUUID()}`
      : baseIdempotencyKey;
    const options: ReviewerGenerationOptions = { ...parsed, idempotencyKey };
    const job = await repository.createGenerationJob({ documentId, requestedBy, options });

    // `after` gives the response a fast 202 path while the job row, lease, and
    // status remain durable. The protected worker route below is the retry path
    // for deployments that use a scheduler or external queue.
    after(async () => {
      try {
        await processReviewerGenerationJob(job.id);
      } catch {
        // The processor records the terminal failure on the job. Do not expose
        // source content or provider details through the response lifecycle.
      }
    });

    return NextResponse.json({
      jobId: job.id,
      reviewerSetId: job.reviewerSetId,
      status: job.status
    }, { status: 202 });
  } catch (error: any) {
    const status = error instanceof RequestSecurityError
      ? error.status
      : typeof error?.status === 'number' ? error.status : 400;
    return NextResponse.json({ error: error?.message || 'Unable to create reviewer generation job' }, { status });
  }
}

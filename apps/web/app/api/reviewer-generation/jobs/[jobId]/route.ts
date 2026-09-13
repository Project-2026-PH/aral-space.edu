import { NextRequest, NextResponse } from 'next/server';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getReviewerGenerationRepository } from '@/lib/reviewer-generation-repository';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const requestedBy = await getAnonymousUserId(req);
    const { jobId } = await context.params;
    const job = await getReviewerGenerationRepository().getJob(jobId, requestedBy);
    if (!job) return NextResponse.json({ error: 'Reviewer generation job not found' }, { status: 404 });

    return NextResponse.json({
      jobId: job.id,
      reviewerSetId: job.reviewerSetId,
      status: job.status,
      stage: job.stage,
      progressPercent: job.progressPercent,
      message: job.message,
      errorCode: job.errorCode,
      errorMessage: job.status === 'failed' ? job.errorMessage : null,
      quizId: job.quizId
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to read reviewer generation job' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { processNextReviewerGenerationJob, processReviewerGenerationJob } from '@/lib/reviewer-generation-worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const configuredSecrets = [process.env.REVIEWER_WORKER_SECRET, process.env.CRON_SECRET].filter(
    (secret): secret is string => Boolean(secret)
  );
  const bearerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const providedSecret = req.headers.get('x-reviewer-worker-secret') || bearerSecret;
  if (configuredSecrets.length === 0 || !providedSecret || !configuredSecrets.includes(providedSecret)) {
    return NextResponse.json({ error: 'Worker authorization required' }, { status: 401 });
  }

  try {
    let jobId: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.jobId === 'string') jobId = body.jobId;
    } catch {
      // Empty body means claim the oldest available job.
    }

    const result = jobId
      ? await processReviewerGenerationJob(jobId)
      : await processNextReviewerGenerationJob();
    return NextResponse.json({ processed: Boolean(result), result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Reviewer worker failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

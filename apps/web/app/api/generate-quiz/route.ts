import { NextRequest } from 'next/server';
import { QuizGenerationController } from '@quiz-creator/controllers/QuizGenerationController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  let isClosed = false;

  const sendProgress = async (data: any) => {
    if (isClosed) return;
    try {
      const payload = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(payload));
    } catch {
      isClosed = true;
    }
  };

  const userId = await getAnonymousUserId(req);

  (async () => {
    const startTime = Date.now();
    try {
      const body = await req.json();
      console.log(`\n[API /generate-quiz] === REQUEST RECEIVED ===`);
      console.log(`[API /generate-quiz] Title: "${body.title || 'Untitled'}" | Pipeline: "${body.pipelineMode || 'auto'}"`);
      console.log(`[API /generate-quiz] Pages received: ${body.pdfPages?.length || 0} | Files summary: ${JSON.stringify(body.filesSummary || [])}`);
      if (body.pdfPages && body.pdfPages.length > 0) {
        console.log(`[API /generate-quiz] Page 1 sample text length: ${body.pdfPages[0].text?.length || 0} chars | Preview: "${body.pdfPages[0].text?.slice(0, 120).replace(/\n/g, ' ')}..."`);
      }

      const quizRepo = await getQuizRepository();
      const controller = new QuizGenerationController(quizRepo);

      await controller.handleStreamingGeneration(body, (progressData) => {
        sendProgress(progressData);
      }, userId);
      console.log(`[API /generate-quiz] === GENERATION COMPLETED SUCCESSFULLY in ${Date.now() - startTime}ms ===\n`);
    } catch (err: any) {
      console.error(`[API /generate-quiz ERROR after ${Date.now() - startTime}ms]:`, err);
      await sendProgress({
        progress: 0,
        message: 'Error',
        detail: err.message || 'Generation failed'
      });
    } finally {
      if (!isClosed) {
        isClosed = true;
        try {
          await writer.close();
        } catch {
          // Stream already closed or aborted, ignore cleanly
        }
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

import { NextRequest } from 'next/server';
import { QuizGenerationController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendProgress = async (data: any) => {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(payload));
  };

  const userId = await getAnonymousUserId(req);

  (async () => {
    try {
      const body = await req.json();
      const quizRepo = await getQuizRepository();
      const controller = new QuizGenerationController(quizRepo);

      await controller.handleStreamingGeneration(body, (progressData) => {
        sendProgress(progressData);
      }, userId);
    } catch (err: any) {
      console.error('[API generate-quiz error]:', err);
      await sendProgress({
        progress: 0,
        message: 'Error',
        detail: err.message || 'Generation failed'
      });
    } finally {
      await writer.close();
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

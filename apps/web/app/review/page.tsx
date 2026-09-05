import { Quiz } from '@quiz-creator/types';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import QuizLibrary from '@/components/quiz/QuizLibrary';

export const dynamic = 'force-dynamic';

export default async function ReviewLibraryPage() {
  let quizzes: Quiz[] = [];

  try {
    const userId = await getAnonymousUserId();
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const data = await controller.listQuizzesAndSubjects(userId);
    quizzes = data.quizzes || [];
  } catch (err) {
    console.error('Failed to load review library:', err);
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Review Library</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Choose a reviewer to continue studying.
        </p>
      </div>
      <QuizLibrary quizzes={quizzes} />
    </div>
  );
}

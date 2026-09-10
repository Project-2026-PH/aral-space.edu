import { Quiz } from '@quiz-creator/types';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import QuizLibrary from '@/components/quiz/QuizLibrary';
import FloatingBottomNav from '@/components/navigation/FloatingBottomNav';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Plus } from 'lucide-react';

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
    <div className="mx-auto max-w-5xl space-y-7 px-4 sm:px-6 lg:px-8 py-6 pb-24 desktop-zoom-133">
      <div className="flex flex-col gap-5 rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-4 sm:p-6 shadow-brutal">
        <Link
          href="/library"
          className="inline-flex w-fit items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" /> Back to library
        </Link>

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-900 bg-[#bfdbfe] shadow-brutal-sm text-slate-900">
              <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  Reviewer Library
                </h1>
                <span className="inline-flex items-center gap-1 rounded-md border-2 border-slate-900 bg-[#fde047] px-2.5 py-1 text-[10px] font-black text-slate-900 shadow-brutal-sm">
                  {quizzes.length} {quizzes.length === 1 ? 'reviewer' : 'reviewers'}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium leading-normal text-muted-foreground">
                Choose a reviewer to continue studying or practice your flashcards.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/new?mode=manual"
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary px-3.5 py-2 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" /> Create Reviewer
            </Link>
          </div>
        </div>
      </div>

      <QuizLibrary quizzes={quizzes} loading={false} />
      <FloatingBottomNav />
    </div>
  );
}

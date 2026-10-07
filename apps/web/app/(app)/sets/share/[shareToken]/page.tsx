import type { Metadata } from 'next';
import Link from 'next/link';
import { Home, ShieldAlert } from 'lucide-react';
import { PublicQuizDto, Quiz, QuizQuestion } from '@quiz-creator/types';
import { getQuizRepository } from '@/lib/db';
import FlashcardReview from '@/components/quiz/FlashcardReview';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}): Promise<Metadata> {
  const { shareToken } = await params;
  try {
    const quizRepo = await getQuizRepository();
    const quiz = await quizRepo.getQuizByShareToken(shareToken);
    if (!quiz) return { title: 'Study Set Not Found' };
    return {
      title: `${quiz.title} - Shared Study Set | Quiz Creator`,
      description: quiz.description || `Study ${quiz.question_count} questions in ${quiz.title}.`,
    };
  } catch {
    return { title: 'Shared Study Set | Quiz Creator' };
  }
}

export default async function SharedStudySetPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  let sharedQuiz: PublicQuizDto | null = null;

  try {
    const quizRepo = await getQuizRepository();
    sharedQuiz = await quizRepo.getQuizByShareToken(shareToken);
  } catch (error) {
    console.error('[SharedStudySetPage] failed to load shared set', {
      shareToken,
      error,
    });

    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-8 shadow-brutal text-center my-12">
        <div className="inline-flex rounded-2xl border-2 border-slate-900 bg-destructive/10 p-4 text-destructive shadow-brutal-sm">
          <ShieldAlert className="h-10 w-10 stroke-[2.5]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">This set is temporarily unavailable</h1>
          <p className="mx-auto max-w-sm text-xs font-medium leading-relaxed text-muted-foreground">
            Please try opening the link again in a moment. Your saved sets are not affected.
          </p>
        </div>
        <Link
          href={`/sets/share/${encodeURIComponent(shareToken)}`}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-primary px-6 py-3 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
        >
          Try Again
        </Link>
      </div>
    );
  }

  if (!sharedQuiz) {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-8 shadow-brutal text-center my-12">
        <div className="inline-flex rounded-2xl border-2 border-slate-900 bg-destructive/10 p-4 text-destructive shadow-brutal-sm">
          <ShieldAlert className="h-10 w-10 stroke-[2.5]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Study Set Not Found</h1>
          <p className="mx-auto max-w-sm text-xs font-medium leading-relaxed text-muted-foreground">
            This link may have expired, been revoked, or set to private by its author.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-primary px-6 py-3 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
        >
          <Home className="h-4 w-4 stroke-[2.5]" />
          Go to Quiz Hub
        </Link>
      </div>
    );
  }

  const quiz: Quiz = {
    ...sharedQuiz,
    questions: (sharedQuiz.questions || []).map((question): QuizQuestion => ({
      ...question,
      quiz_id: sharedQuiz.id,
      correct_answer: question.correct_answer ?? 0,
    }))
  } as Quiz;

  return (
    <FlashcardReview
      quiz={quiz}
      questions={quiz.questions || []}
      shareToken={shareToken}
      exitHref="/library"
    />
  );
}

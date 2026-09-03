'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ManualQuizCreator from '@/components/quiz/ManualQuizCreator';
import AiQuizGenerator from '@/components/quiz/AiQuizGenerator';
import { Sparkles, PenLine, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function NewQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'manual' ? 'manual' : 'ai';
  const [mode, setMode] = useState<'ai' | 'manual'>(initialMode);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Hub
        </Link>

        {/* Segmented Switcher */}
        <div className="inline-flex items-center p-1 rounded-2xl border border-border bg-card/80 shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'ai'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Studio</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'manual'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PenLine className="h-3.5 w-3.5" />
            <span>Manual Builder</span>
          </button>
        </div>
      </div>

      {mode === 'ai' ? (
        <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Quiz Generation Studio</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              Generate Reviewer with AI
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select an AI pipeline mode tailored for speed or pedagogical rigor, then paste your notes or lecture materials.
            </p>
          </div>

          <AiQuizGenerator
            onGenerated={(quizId) => router.push(`/quizzes/${quizId}`)}
            onCancel={() => router.push('/')}
          />
        </div>
      ) : (
        <ManualQuizCreator
          onSwitchToAi={() => setMode('ai')}
        />
      )}
    </div>
  );
}

export default function NewQuizPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-12 text-center text-xs text-muted-foreground">Loading studio...</div>}>
      <NewQuizContent />
    </Suspense>
  );
}

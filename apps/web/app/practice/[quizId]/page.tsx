'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import QuizRunner from '@/components/quiz/QuizRunner';
import { Quiz, QuizQuestion, QuizSession, QuestionProgress, QuizMode } from '@quiz-creator/types';

export default function PracticePage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = React.use(params);
  const searchParams = useSearchParams();

  const mode = (searchParams.get('mode') as QuizMode) || 'learn';
  const shuffleQuestions = searchParams.get('shuffleQuestions') === 'true';
  const shuffleOptions = searchParams.get('shuffleOptions') !== 'false';

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [progress, setProgress] = useState<QuestionProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initSession() {
      if (!quizId) return;
      try {
        // Fetch quiz metadata and start session concurrently
        const [quizRes, sessRes] = await Promise.all([
          fetch(`/api/quizzes/${quizId}`),
          fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start', quizId })
          })
        ]);

        if (!quizRes.ok) throw new Error('Quiz not found');
        if (!sessRes.ok) throw new Error('Failed to start session');

        const [quizData, sessData] = await Promise.all([
          quizRes.json(),
          sessRes.json()
        ]);

        setQuiz(quizData);
        setQuestions(sessData.questions || []);
        setSession(sessData.session || null);
        setProgress(sessData.progress || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, [quizId]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center text-xs text-muted-foreground animate-pulse">
        Initializing practice session...
      </div>
    );
  }

  if (error || !quiz || !session) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-3">
        <p className="text-sm font-bold text-destructive">{error || 'Session initialization failed'}</p>
      </div>
    );
  }

  return (
    <QuizRunner
      quiz={quiz}
      initialQuestions={questions}
      initialSession={session}
      initialProgress={progress}
      mode={mode}
      shuffleQuestions={shuffleQuestions}
      shuffleOptions={shuffleOptions}
    />
  );
}

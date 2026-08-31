'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QuizOverviewClient from '@/components/quiz/QuizOverviewClient';
import { Quiz, QuizQuestion, QuizSession } from '@quiz-creator/types';

export default function QuizDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params?.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuiz() {
      if (!quizId) return;
      try {
        const res = await fetch(`/api/quizzes/${quizId}`);
        if (!res.ok) throw new Error('Quiz not found');
        const data = await res.json();
        setQuiz(data);
        setQuestions(data.questions || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [quizId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-xs text-muted-foreground animate-pulse">
        Loading quiz details...
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <p className="text-sm font-bold text-destructive">{error || 'Quiz not found'}</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return <QuizOverviewClient quiz={quiz} questions={questions} sessions={sessions} />;
}

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PublicQuizDto } from '@quiz-creator/types';
import {
  Sparkles,
  BookOpen,
  Layers,
  Play,
  RotateCw,
  Copy,
  CheckCircle2,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight,
  List,
  Sparkle,
  ArrowRight,
  ShieldAlert,
  Home,
  Check,
  Award
} from 'lucide-react';
import Link from 'next/link';

export default function SharedStudySetPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params?.shareToken as string;

  const [quiz, setQuiz] = useState<PublicQuizDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [clonedSuccess, setClonedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive Preview State
  const [viewMode, setViewMode] = useState<'flashcard' | 'list'>('flashcard');
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Guest Study Runner Mode State
  const [isStudying, setIsStudying] = useState(false);
  const [studyCardIdx, setStudyCardIdx] = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [studyCompleted, setStudyCompleted] = useState(false);

  useEffect(() => {
    async function loadPublicQuiz() {
      if (!shareToken) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/sets/${shareToken}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('This shared study set was not found or access has been revoked by the creator.');
          }
          throw new Error('Failed to load shared study set.');
        }
        const data = await res.json();
        setQuiz(data);
      } catch (err: any) {
        setError(err.message || 'Unable to load study set.');
      } finally {
        setLoading(false);
      }
    }

    loadPublicQuiz();
  }, [shareToken]);

  async function handleClone() {
    if (!quiz || !quiz.allow_cloning || cloning) return;
    setCloning(true);
    try {
      const res = await fetch(`/api/public/sets/${shareToken}/clone`, {
        method: 'POST'
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to clone study set');
      }
      const cloned = await res.json();
      setClonedSuccess(true);
      setTimeout(() => {
        router.push(`/quizzes/${cloned.id}`);
      }, 800);
    } catch (err: any) {
      alert(err.message || 'Could not clone study set.');
      setCloning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary animate-pulse">
          <Sparkles className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-foreground">Loading shared study set...</p>
      </div>
    );
  }

  // 404 / Revoked Link Screen
  if (error || !quiz) {
    return (
      <div className="max-w-lg mx-auto py-20 px-4 text-center space-y-6 animate-fade-in">
        <div className="inline-flex p-5 rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-foreground">Study Set Not Found</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {error || 'This link may have expired, been revoked, or set to private by its author.'}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Home className="h-4 w-4" />
            <span>Go to Quiz Hub</span>
          </Link>
        </div>
      </div>
    );
  }

  // Guest Study Interactive Session View
  if (isStudying) {
    if (studyCompleted) {
      return (
        <div className="max-w-md mx-auto py-16 px-4 text-center space-y-6 animate-fade-in">
          <div className="inline-flex p-5 rounded-full bg-emerald-500/10 text-emerald-500">
            <Award className="h-12 w-12" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-extrabold text-foreground">Practice Completed!</h2>
            <p className="text-xs text-muted-foreground">
              You reviewed all {quiz.questions.length} cards in &quot;{quiz.title}&quot;.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setStudyCardIdx(0);
                setStudyFlipped(false);
                setMasteredCount(0);
                setStudyCompleted(false);
              }}
              className="rounded-2xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-all"
            >
              Restart Practice
            </button>
            <button
              onClick={handleClone}
              disabled={cloning || !quiz.allow_cloning}
              className="rounded-2xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
            >
              {clonedSuccess ? 'Saved to Library!' : 'Save Set to Library'}
            </button>
          </div>
        </div>
      );
    }

    const currentCard = quiz.questions[studyCardIdx];
    const correctOpt = currentCard.options[currentCard.correct_answer] || currentCard.options[0] || 'Correct';

    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20 animate-fade-in">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsStudying(false)}
            className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            ← Exit Guest Practice
          </button>
          <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
            Card {studyCardIdx + 1} / {quiz.questions.length}
          </span>
        </div>

        {/* Practice Flashcard */}
        <div
          onClick={() => setStudyFlipped(!studyFlipped)}
          className="min-h-[280px] rounded-3xl border border-border/80 bg-card p-8 shadow-md cursor-pointer flex flex-col justify-between transition-all hover:border-primary/50"
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>{studyFlipped ? 'Answer & Explanation' : 'Prompt (Click card to flip)'}</span>
            <RotateCw className="h-3.5 w-3.5" />
          </div>

          <div className="py-6 text-center">
            {!studyFlipped ? (
              <p className="text-base sm:text-lg font-extrabold text-foreground leading-relaxed">
                {currentCard.question_text}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-lg font-extrabold text-primary">{correctOpt}</p>
                {currentCard.explanation && (
                  <p className="text-xs text-muted-foreground italic max-w-md mx-auto">
                    💡 {currentCard.explanation}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/30">
            <span className="text-[11px] text-muted-foreground">Click to flip</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (studyCardIdx + 1 < quiz.questions.length) {
                  setStudyCardIdx(prev => prev + 1);
                  setStudyFlipped(false);
                } else {
                  setStudyCompleted(true);
                }
              }}
              className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPreviewCard = quiz.questions[cardIndex];
  const correctText = currentPreviewCard?.options[currentPreviewCard.correct_answer] || currentPreviewCard?.options[0] || '';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 animate-fade-in">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Shared Study Set
              </span>
              {quiz.subject && (
                <span
                  style={{
                    backgroundColor: quiz.subject.color,
                    color: '#0f172a'
                  }}
                  className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-extrabold shadow-2xs"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {quiz.subject.name}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {quiz.title}
            </h1>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{quiz.question_count} Terms / Questions</span>
              {quiz.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(quiz.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 sm:pt-0">
            <button
              onClick={() => {
                setStudyCardIdx(0);
                setStudyFlipped(false);
                setIsStudying(true);
              }}
              className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Practice Now</span>
            </button>

            {quiz.allow_cloning ? (
              <button
                onClick={handleClone}
                disabled={cloning}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                  clonedSuccess
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'border-border bg-background hover:bg-muted text-foreground'
                }`}
              >
                {clonedSuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>{cloning ? 'Saving...' : 'Clone to Library'}</span>
                  </>
                )}
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-3 py-2 rounded-2xl border border-border/50">
                Cloning disabled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mode View Switcher */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Study Set Preview
        </h2>
        <div className="flex items-center rounded-xl border border-border/80 bg-card p-1 shadow-2xs">
          <button
            onClick={() => setViewMode('flashcard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'flashcard'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Flashcards</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'list'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>List View</span>
          </button>
        </div>
      </div>

      {/* Interactive Flashcard Preview Carousel */}
      {viewMode === 'flashcard' && currentPreviewCard && (
        <div className="space-y-4">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="min-h-[300px] rounded-3xl border border-border/80 bg-card p-8 sm:p-12 shadow-sm cursor-pointer flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>{isFlipped ? 'Answer' : 'Prompt / Term'}</span>
              <span className="flex items-center gap-1 text-primary">
                <RotateCw className="h-3.5 w-3.5" />
                <span>Click to Flip</span>
              </span>
            </div>

            <div className="py-8 text-center">
              {!isFlipped ? (
                <p className="text-lg sm:text-xl font-extrabold text-foreground leading-relaxed max-w-xl mx-auto">
                  {currentPreviewCard.question_text}
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xl sm:text-2xl font-extrabold text-primary">
                    {correctText}
                  </p>
                  {currentPreviewCard.explanation && (
                    <p className="text-xs text-muted-foreground italic max-w-md mx-auto">
                      💡 {currentPreviewCard.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="text-center text-xs text-muted-foreground font-medium">
              Card {cardIndex + 1} of {quiz.questions.length}
            </div>
          </div>

          {/* Carousel Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setCardIndex(prev => Math.max(0, prev - 1));
                setIsFlipped(false);
              }}
              disabled={cardIndex === 0}
              className="p-3 rounded-2xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 transition-all"
              title="Previous Card"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-foreground px-4 py-2 rounded-xl bg-card border border-border">
              {cardIndex + 1} / {quiz.questions.length}
            </span>
            <button
              onClick={() => {
                setCardIndex(prev => Math.min(quiz.questions.length - 1, prev + 1));
                setIsFlipped(false);
              }}
              disabled={cardIndex === quiz.questions.length - 1}
              className="p-3 rounded-2xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 transition-all"
              title="Next Card"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {quiz.questions.map((q, idx) => (
            <div
              key={q.id || idx}
              className="rounded-2xl border border-border/80 bg-card p-5 shadow-2xs space-y-3"
            >
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-bold text-foreground leading-relaxed">
                    {q.question_text}
                  </p>
                  <p className="text-xs font-semibold text-primary">
                    Answer: {q.options[q.correct_answer] || q.options[0]}
                  </p>
                  {q.explanation && (
                    <p className="text-[11px] text-muted-foreground italic">
                      💡 {q.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

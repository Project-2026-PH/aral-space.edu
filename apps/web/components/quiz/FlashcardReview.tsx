'use client';

import { useEffect, useMemo, useState } from 'react';
import { Quiz, QuizQuestion } from '@quiz-creator/types';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Layers,
  Lightbulb,
  Maximize,
  Pencil,
  PenTool,
  Play,
  Settings,
  Star,
  Volume2,
  X
} from 'lucide-react';
import Link from 'next/link';

interface FlashcardReviewProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  shareToken?: string;
  subjectShareToken?: string;
}

interface CardToolbarProps {
  quizId: string;
  isStarred: boolean;
  onHint: () => void;
  onSpeak: () => void;
  onToggleStar: () => void;
  canEdit: boolean;
}

function getAnswer(question: QuizQuestion): string {
  return question.answer_text?.trim() || question.options[question.correct_answer]?.trim() || question.options[0]?.trim() || 'No answer provided.';
}

function CardToolbar({ quizId, isStarred, onHint, onSpeak, onToggleStar, canEdit }: CardToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs font-semibold text-muted-foreground" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted hover:text-foreground"
        onClick={onHint}
      >
        <Lightbulb className="h-4 w-4 text-primary" />
        Get a hint
      </button>
      <div className="flex items-center gap-4">
        {canEdit && (
          <Link href={`/quizzes/${quizId}`} aria-label="Edit reviewer" className="text-muted-foreground transition-colors hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </Link>
        )}
        <button type="button" onClick={onSpeak} aria-label="Read card aloud" className="text-muted-foreground transition-colors hover:text-foreground">
          <Volume2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onToggleStar} aria-label={isStarred ? 'Unstar card' : 'Star card'} className="text-muted-foreground transition-colors hover:text-foreground">
          <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-300 text-amber-300' : ''}`} />
        </button>
      </div>
    </div>
  );
}

export default function FlashcardReview({ quiz, questions, shareToken, subjectShareToken }: FlashcardReviewProps) {
  const sharedQuery = shareToken ? `&shareToken=${encodeURIComponent(shareToken)}` : '';
  const exitHref = subjectShareToken ? `/subjects/share/${encodeURIComponent(subjectShareToken)}` : '/review/';
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [trackProgress, setTrackProgress] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [cards, setCards] = useState(questions);

  useEffect(() => {
    setCards(questions);
    setCardIndex(0);
    setIsFlipped(false);
  }, [questions]);

  useEffect(() => {
    if (!isAutoPlaying || cards.length < 2) return;

    const timer = window.setInterval(() => {
      setCardIndex((current) => (current + 1) % cards.length);
      setIsFlipped(false);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [cards.length, isAutoPlaying]);

  const currentCard = cards[cardIndex];
  const progress = useMemo(
    () => (cards.length > 0 ? ((cardIndex + 1) / cards.length) * 100 : 0),
    [cardIndex, cards.length]
  );

  function goToCard(nextIndex: number) {
    setCardIndex(nextIndex);
    setIsFlipped(false);
  }

  function shuffleCards() {
    setCards((current) => [...current].sort(() => Math.random() - 0.5));
    setCardIndex(0);
    setIsFlipped(false);
  }

  function speakCard() {
    if (!currentCard || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(
      isFlipped ? getAnswer(currentCard) : currentCard.question_text
    ));
  }

  function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  }

  if (!currentCard) {
    return (
      <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        This reviewer does not have any flashcards yet.
      </div>
    );
  }

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-background px-4 py-5 text-foreground sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={exitHref}
              className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Exit review
            </Link>
            <h1 className="truncate text-lg font-bold text-foreground">In-class review</h1>
            <p className="truncate text-xs text-muted-foreground">{quiz.title}</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg bg-primary px-3 py-3 text-xs font-bold text-white shadow-sm ring-1 ring-primary/20"
            aria-pressed="true"
          >
            <span className="flex h-6 items-center gap-1.5" aria-hidden="true">
              <span className="h-5 w-5 rounded bg-white/90 shadow-[5px_3px_0_0_hsl(var(--accent))]" />
            </span>
            Flashcards
          </button>
          <Link
            href={`/practice/${quiz.id}?mode=identification${sharedQuery}`}
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PenTool className="h-6 w-6 text-primary" />
            Identification
          </Link>
          <Link
            href={`/practice/${quiz.id}?mode=multiple_choice${sharedQuery}`}
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Layers className="h-6 w-6 text-primary" />
            Multiple Choice
          </Link>
        </div>

        <div
          className="perspective-1000 h-[430px] cursor-pointer sm:h-[500px]"
          onClick={() => setIsFlipped((current) => !current)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsFlipped((current) => !current);
            }
          }}
          aria-label={isFlipped ? 'Show flashcard prompt' : 'Show flashcard answer'}
        >
          <div className={`relative h-full transform-style-3d transition-transform duration-500 ease-in-out ${isFlipped ? 'rotate-x-180' : ''}`}>
            <div className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm backface-hidden transition-shadow hover:border-primary/40 hover:shadow-md sm:p-7" aria-hidden={isFlipped}>
              <CardToolbar
                quizId={quiz.id}
                isStarred={isStarred}
                onHint={() => setIsFlipped(true)}
                onSpeak={speakCard}
                onToggleStar={() => setIsStarred((current) => !current)}
                canEdit={!shareToken}
              />
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden [overflow-wrap:anywhere] px-4 py-10 text-center">
                <p className="max-h-full max-w-3xl overflow-hidden break-words text-xl font-medium leading-snug text-foreground [overflow-wrap:anywhere] line-clamp-10 sm:text-2xl">{currentCard.question_text}</p>
              </div>
              <div className="text-center text-xs font-semibold text-muted-foreground">
                Click the card to reveal the answer
              </div>
            </div>

            <div className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm backface-hidden rotate-x-180 sm:p-7" aria-hidden={!isFlipped}>
              <CardToolbar
                quizId={quiz.id}
                isStarred={isStarred}
                onHint={() => setIsFlipped(true)}
                onSpeak={speakCard}
                onToggleStar={() => setIsStarred((current) => !current)}
                canEdit={!shareToken}
              />
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden [overflow-wrap:anywhere] px-4 py-10 text-center">
                <div className="max-w-3xl space-y-4">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Answer</span>
                  <p className="max-h-full max-w-3xl overflow-hidden break-words text-xl font-medium leading-snug text-primary [overflow-wrap:anywhere] line-clamp-8 sm:text-3xl">{getAnswer(currentCard)}</p>
                  {currentCard.explanation && (
                    <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">{currentCard.explanation}</p>
                  )}
                </div>
              </div>
              <div className="text-center text-xs font-semibold text-muted-foreground">
                Click the card to see the prompt
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          <button
            type="button"
            onClick={() => goToCard(Math.max(0, cardIndex - 1))}
            disabled={cardIndex === 0}
            aria-label="Previous flashcard"
            className="flex h-11 w-16 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <span className="min-w-14 text-center text-sm font-bold text-foreground">{cardIndex + 1} / {cards.length}</span>
          <button
            type="button"
            onClick={() => goToCard(Math.min(cards.length - 1, cardIndex + 1))}
            disabled={cardIndex === cards.length - 1}
            aria-label="Next flashcard"
            className="flex h-11 w-16 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 text-muted-foreground">
          <button
            type="button"
            role="switch"
            aria-checked={trackProgress}
            onClick={() => setTrackProgress((current) => !current)}
            className="inline-flex items-center gap-2 text-sm font-semibold"
          >
            <span>Track progress</span>
            <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${trackProgress ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`h-4 w-4 rounded-full bg-card shadow-sm transition-transform ${trackProgress ? 'translate-x-4' : ''}`} />
            </span>
          </button>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setIsAutoPlaying((current) => !current)} aria-label={isAutoPlaying ? 'Pause autoplay' : 'Play autoplay'} className="rounded-full border border-border bg-card p-3 transition-colors hover:bg-muted">
              {isAutoPlaying ? <span className="text-sm font-black text-foreground">Ⅱ</span> : <Play className="h-4 w-4 fill-current text-foreground" />}
            </button>
            <button type="button" onClick={shuffleCards} aria-label="Shuffle flashcards" className="rounded-full border border-border bg-card p-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Expand className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Review settings" className="rounded-full border border-border bg-card p-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Settings className="h-4 w-4" />
            </button>
            <button type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>

        {trackProgress && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${Math.round(progress)} percent reviewed`}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

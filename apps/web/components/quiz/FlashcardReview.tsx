'use client';

import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Quiz, QuizQuestion } from '@quiz-creator/types';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Lightbulb,
  Maximize,
  Pencil,
  PenTool,
  Settings,
  Shuffle,
  Star,
  Volume2,
  X
} from 'lucide-react';
import Link from 'next/link';
import { getQuestionHint } from '@/lib/quizAnswerEvaluation';
import { quizAudio } from '@/lib/audio';
import Modal from '@/components/ui/Modal';
import WindFlameBadge from '@/components/quiz/WindFlameBadge';
import { getQuizStreakRecord, recordSessionCompletion } from '@/lib/streakTracker';

interface FlashcardReviewProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  shareToken?: string;
  subjectShareToken?: string;
}

interface CardToolbarProps {
  quizId: string;
  isStarred: boolean;
  isHintVisible?: boolean;
  onHint?: () => void;
  onSpeak: () => void;
  onToggleStar: () => void;
  canEdit: boolean;
}

function getAnswer(question: QuizQuestion): string {
  return question.answer_text?.trim() || question.options[question.correct_answer]?.trim() || question.options[0]?.trim() || 'No answer provided.';
}

const SWIPE_EXIT_DURATION_MS = 520;
const FLASHCARD_SETTINGS_VERSION = 1;
const FLASHCARD_SESSION_VERSION = 1;

type FlashcardSettings = {
  shuffleQuestions: boolean;
  saveProgress: boolean;
};

type FlashcardSessionSnapshot = {
  version: number;
  cardIds: string[];
  cardIndex: number;
  incorrectIds: string[];
  isFlipped: boolean;
  hasSeenAnswer: boolean;
};

function shuffleList<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function getFlashcardSettingsKey(quizId: string): string {
  return `quiz-creator:flashcard-settings:${quizId}`;
}

function getFlashcardSessionKey(quizId: string): string {
  return `quiz-creator:flashcard-session:${quizId}`;
}

function CardToolbar({ quizId, isStarred, isHintVisible, onHint, onSpeak, onToggleStar, canEdit }: CardToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs font-semibold text-muted-foreground" onClick={(event) => event.stopPropagation()}>
      {onHint ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted hover:text-foreground"
          onClick={onHint}
        >
          <Lightbulb className={`h-4 w-4 ${isHintVisible ? 'text-amber-500 fill-amber-500/20' : 'text-primary'}`} />
          {isHintVisible ? 'Hide hint' : 'Get a hint'}
        </button>
      ) : <div />}
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
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [trackProgress, setTrackProgress] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [cards, setCards] = useState(questions);
  const [incorrectIds, setIncorrectIds] = useState<string[]>([]);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [saveProgress, setSaveProgress] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [hasSeenAnswer, setHasSeenAnswer] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const swipeOverlayRef = useRef<HTMLDivElement>(null);
  const swipeLeftLabelRef = useRef<HTMLSpanElement>(null);
  const swipeRightLabelRef = useRef<HTMLSpanElement>(null);
  const swipeFrameRef = useRef<number | null>(null);
  const pendingSwipeOffsetRef = useRef(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasSeenAnswerRef = useRef(false);
  const suppressClickRef = useRef(false);
  const swipeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    quizAudio.preload();
    const record = getQuizStreakRecord(quiz.id);
    if (record.allTimeBestStreak > 0) {
      setBestStreak(record.allTimeBestStreak);
    }
  }, [quiz.id]);

  useEffect(() => {
    setSessionHydrated(false);

    const defaultSettings: FlashcardSettings = {
      shuffleQuestions: false,
      saveProgress: true
    };
    let settings = defaultSettings;

    if (typeof window !== 'undefined') {
      try {
        const storedSettings = JSON.parse(window.localStorage.getItem(getFlashcardSettingsKey(quiz.id)) || 'null') as Partial<FlashcardSettings> | null;
        if (storedSettings) {
          settings = {
            shuffleQuestions: storedSettings.shuffleQuestions === true,
            saveProgress: storedSettings.saveProgress !== false
          };
        }
      } catch {
        settings = defaultSettings;
      }
    }

    setShuffleQuestions(settings.shuffleQuestions);
    setSaveProgress(settings.saveProgress);

    const byId = new Map(questions.map((question) => [question.id, question]));
    let restored = false;

    if (typeof window !== 'undefined' && settings.saveProgress) {
      try {
        const snapshot = JSON.parse(window.localStorage.getItem(getFlashcardSessionKey(quiz.id)) || 'null') as FlashcardSessionSnapshot | null;
        const restoredCards = snapshot?.version === FLASHCARD_SESSION_VERSION
          ? snapshot.cardIds.map((id) => byId.get(id)).filter((question): question is QuizQuestion => Boolean(question))
          : [];

        if (restoredCards.length > 0) {
          setCards(restoredCards);
          setCardIndex(Math.min(Math.max(snapshot?.cardIndex || 0, 0), restoredCards.length - 1));
          setIncorrectIds((snapshot?.incorrectIds || []).filter((id) => byId.has(id)));
          setIsFlipped(snapshot?.isFlipped === true);
          hasSeenAnswerRef.current = snapshot?.hasSeenAnswer === true;
          setHasSeenAnswer(snapshot?.hasSeenAnswer === true);
          setIsHintVisible(false);
          restored = true;
        }
      } catch {
        // Ignore malformed saved sessions and start a fresh round.
      }
    }

    if (!restored) {
      setCards(settings.shuffleQuestions ? shuffleList(questions) : [...questions]);
      setCardIndex(0);
      setIncorrectIds([]);
      setIsFlipped(false);
      hasSeenAnswerRef.current = false;
      setHasSeenAnswer(false);
      setIsHintVisible(false);
    }

    setSessionHydrated(true);
  }, [quiz.id, questions]);

  useEffect(() => {
    if (!sessionHydrated || typeof window === 'undefined') return;

    try {
      if (!saveProgress) {
        window.localStorage.removeItem(getFlashcardSessionKey(quiz.id));
      } else {
        const snapshot: FlashcardSessionSnapshot = {
          version: FLASHCARD_SESSION_VERSION,
          cardIds: cards.map((card) => card.id),
          cardIndex,
          incorrectIds,
          isFlipped,
          hasSeenAnswer
        };
        window.localStorage.setItem(getFlashcardSessionKey(quiz.id), JSON.stringify(snapshot));
      }

      window.localStorage.setItem(getFlashcardSettingsKey(quiz.id), JSON.stringify({
        version: FLASHCARD_SETTINGS_VERSION,
        shuffleQuestions,
        saveProgress
      }));
    } catch {
      // Ignore storage restrictions and keep the in-memory session usable.
    }
  }, [quiz.id, sessionHydrated, saveProgress, shuffleQuestions, cards, cardIndex, incorrectIds, isFlipped, hasSeenAnswer]);

  useEffect(() => {
    return () => {
      if (swipeTimerRef.current !== null) {
        window.clearTimeout(swipeTimerRef.current);
      }
      if (swipeFrameRef.current !== null) {
        window.cancelAnimationFrame(swipeFrameRef.current);
      }
    };
  }, []);

  const currentCard = cards[cardIndex];
  const progress = useMemo(
    () => (cards.length > 0 ? ((cardIndex + 1) / cards.length) * 100 : 0),
    [cardIndex, cards.length]
  );
  function updateSwipeTransform(offset: number) {
    if (!cardRef.current) return;
    cardRef.current.style.transform = offset === 0
      ? ''
      : `translate3d(${offset}px, 0, 0) rotate(${offset / 12}deg)`;
  }

  function updateSwipeFeedback(offset: number) {
    const overlay = swipeOverlayRef.current;
    if (!overlay) return;

    const progress = Math.min(Math.abs(offset) / 180, 1);
    const isLeft = offset < 0;
    const color = isLeft ? '#f97316' : '#22c55e';
    overlay.style.opacity = offset === 0 ? '0' : String(progress);
    overlay.style.borderColor = color;
    overlay.style.color = color;
    overlay.style.backgroundColor = isLeft ? 'rgba(249, 115, 22, 0.14)' : 'rgba(34, 197, 94, 0.14)';
    if (swipeLeftLabelRef.current) swipeLeftLabelRef.current.style.display = isLeft ? 'inline' : 'none';
    if (swipeRightLabelRef.current) swipeRightLabelRef.current.style.display = isLeft ? 'none' : 'inline';
  }

  function applySwipeVisual(offset: number) {
    updateSwipeTransform(offset);
    updateSwipeFeedback(offset);
  }

  function queueSwipeVisual(offset: number) {
    pendingSwipeOffsetRef.current = offset;
    if (swipeFrameRef.current !== null) return;

    swipeFrameRef.current = window.requestAnimationFrame(() => {
      swipeFrameRef.current = null;
      applySwipeVisual(pendingSwipeOffsetRef.current);
    });
  }

  function cancelPendingSwipeFrame() {
    if (swipeFrameRef.current === null) return;
    window.cancelAnimationFrame(swipeFrameRef.current);
    swipeFrameRef.current = null;
  }

  function goToCard(nextIndex: number) {
    setCardIndex(nextIndex);
    setIsFlipped(false);
    hasSeenAnswerRef.current = false;
    setHasSeenAnswer(false);
    setIsHintVisible(false);
    setSwipeOffset(0);
    updateSwipeFeedback(0);
  }

  function completeCard(known: boolean) {
    if (!currentCard) return;

    const nextIncorrectIds = known
      ? incorrectIds.filter((id) => id !== currentCard.id)
      : Array.from(new Set([...incorrectIds, currentCard.id]));

    recordCardResult(known);
    setIncorrectIds(nextIncorrectIds);

    if (cardIndex < cards.length - 1) {
      goToCard(cardIndex + 1);
      return;
    }

    const retryCards = questions.filter((question) => nextIncorrectIds.includes(question.id));
    const nextRound = retryCards.length > 0 ? retryCards : questions;
    setCards(shuffleQuestions ? shuffleList(nextRound) : [...nextRound]);
    setCardIndex(0);
    setIsFlipped(false);
    hasSeenAnswerRef.current = false;
    setHasSeenAnswer(false);
    setIsHintVisible(false);
    setSwipeOffset(0);
    updateSwipeFeedback(0);

    if (retryCards.length === 0) {
      setIncorrectIds([]);
    }
  }

  function handleCardPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!hasSeenAnswerRef.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    cancelPendingSwipeFrame();
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    setSwipeOffset(0);
    applySwipeVisual(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCardPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    if (!start || !hasSeenAnswerRef.current) return;

    const offsetX = event.clientX - start.x;
    const offsetY = event.clientY - start.y;
    if (Math.abs(offsetY) > Math.abs(offsetX) && Math.abs(offsetY) > 10) {
      cancelPendingSwipeFrame();
      swipeStartRef.current = null;
      setIsDragging(false);
      setSwipeOffset(0);
      applySwipeVisual(0);
      return;
    }

    queueSwipeVisual(offsetX);
  }

  function handleCardPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    cancelPendingSwipeFrame();
    if (!start || !hasSeenAnswerRef.current) return;

    const offsetX = event.clientX - start.x;
    const offsetY = event.clientY - start.y;
    applySwipeVisual(offsetX);
    setIsDragging(false);

    if (Math.abs(offsetX) < 90 || Math.abs(offsetX) <= Math.abs(offsetY)) {
      setSwipeOffset(0);
      updateSwipeFeedback(0);
      return;
    }

    const known = offsetX > 0;
    if (known) void quizAudio.playCorrectSound();
    suppressClickRef.current = true;
    const exitDistance = Math.max(window.innerWidth, 600) * 1.2;
    setSwipeOffset(known ? exitDistance : -exitDistance);
    swipeTimerRef.current = window.setTimeout(() => {
      swipeTimerRef.current = null;
      updateSwipeFeedback(0);
      setIsDragging(true);
      if (cardRef.current) {
        cardRef.current.style.transition = 'none';
        cardRef.current.style.transform = '';
      }
      completeCard(known);
      window.requestAnimationFrame(() => setIsDragging(false));
      suppressClickRef.current = false;
    }, SWIPE_EXIT_DURATION_MS);
  }

  function handleCardPointerCancel() {
    cancelPendingSwipeFrame();
    swipeStartRef.current = null;
    setIsDragging(false);
    setSwipeOffset(0);
    applySwipeVisual(0);
  }

  function toggleCard() {
    setIsFlipped((current) => {
      if (!current) {
        hasSeenAnswerRef.current = true;
        setHasSeenAnswer(true);
      }
      return !current;
    });
  }

  function handleCardClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    toggleCard();
  }

  function recordCardResult(known: boolean) {
    if (known) {
      setStreak((prev) => {
        const nextStreak = prev + 1;
        setBestStreak((currentBest) => {
          const updated = Math.max(currentBest, nextStreak);
          recordSessionCompletion(quiz.id, 'flashcard', updated, nextStreak, cards.length);
          return updated;
        });
        return nextStreak;
      });
    } else {
      setStreak(0);
      setBestStreak((currentBest) => {
        recordSessionCompletion(quiz.id, 'flashcard', currentBest, 0, cards.length);
        return currentBest;
      });
    }
  }

  function handleShuffleSettingChange(enabled: boolean) {
    setShuffleQuestions(enabled);
    const nextCards = enabled ? shuffleList(questions) : [...questions];
    setCards(nextCards);
    setCardIndex(0);
    setIncorrectIds([]);
    setIsFlipped(false);
    hasSeenAnswerRef.current = false;
    setHasSeenAnswer(false);
    setIsHintVisible(false);
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
          <WindFlameBadge
            streak={streak}
            totalQuestions={cards.length}
            bestStreak={bestStreak}
            size="md"
          />
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
          ref={cardRef}
          className="perspective-1000 relative h-[430px] cursor-pointer touch-pan-y select-none sm:h-[500px]"
          onClick={handleCardClick}
          onPointerDown={handleCardPointerDown}
          onPointerMove={handleCardPointerMove}
          onPointerUp={handleCardPointerUp}
          onPointerCancel={handleCardPointerCancel}
          style={{
            transform: swipeOffset ? `translateX(${swipeOffset}px) rotate(${swipeOffset / 12}deg)` : undefined,
            transition: isDragging ? 'none' : `transform ${SWIPE_EXIT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            willChange: 'transform'
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key.toLowerCase() === 'h') {
              event.preventDefault();
              setIsHintVisible((current) => !current);
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleCard();
            }
          }}
          aria-label={isFlipped ? 'Show flashcard prompt' : 'Show flashcard answer'}
        >
          <div className={`relative h-full transform-style-3d transition-transform duration-500 ease-in-out ${isFlipped ? 'rotate-x-180' : ''}`}>
            <div className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm backface-hidden transition-shadow hover:border-primary/40 hover:shadow-md sm:p-7" aria-hidden={isFlipped}>
              <CardToolbar
                quizId={quiz.id}
                isStarred={isStarred}
                isHintVisible={isHintVisible}
                onHint={() => setIsHintVisible((current) => !current)}
                onSpeak={speakCard}
                onToggleStar={() => setIsStarred((current) => !current)}
                canEdit={!shareToken}
              />
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden [overflow-wrap:anywhere] px-4 py-10 text-center">
                <div className="max-w-3xl space-y-4">
                  <p className="max-h-full max-w-3xl overflow-hidden break-words text-xl font-medium leading-snug text-foreground [overflow-wrap:anywhere] line-clamp-10 sm:text-2xl">{currentCard.question_text}</p>
                  {isHintVisible && (
                    <div
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs font-mono font-medium text-amber-700 dark:text-amber-300"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
                      <span>Hint: {getQuestionHint(currentCard)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center text-xs font-semibold text-muted-foreground">
                Click the card to reveal the answer
              </div>
            </div>

            <div className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm backface-hidden rotate-x-180 sm:p-7" aria-hidden={!isFlipped}>
              <CardToolbar
                quizId={quiz.id}
                isStarred={isStarred}
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
                Swipe left if you missed it · swipe right if you got it right
              </div>
              <div className="mt-3 flex items-center justify-center gap-3" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    completeCard(false);
                  }}
                  className="rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Still learning
                </button>
                <button
                  type="button"
                  onClick={() => {
                    completeCard(true);
                  }}
                  className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Got it right ✓
                </button>
              </div>
            </div>
          </div>
          <div
            ref={swipeOverlayRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-4 text-center text-2xl font-black tracking-[0.18em]"
            style={{ opacity: 0 }}
          >
            <span ref={swipeLeftLabelRef} style={{ display: 'none' }}>STILL LEARNING</span>
            <span ref={swipeRightLabelRef}>GOT IT RIGHT</span>
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
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Flashcard settings"
              className="rounded-full border border-border bg-card p-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
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

        <Modal
          open={showSettingsModal}
          onOpenChange={setShowSettingsModal}
          title="Flashcard Settings"
          description="Configure question order and session progress without leaving your review."
        >
          <div className="space-y-5 pt-1">
            <div className="space-y-2 border-b border-border/40 pb-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Question Order
              </label>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Shuffle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Shuffle Questions</p>
                    <p className="text-[10px] text-muted-foreground">Shuffle the first round and every automatic reset</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shuffleQuestions}
                  onClick={() => handleShuffleSettingChange(!shuffleQuestions)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${shuffleQuestions ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${shuffleQuestions ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Session
              </label>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-3.5">
                <div>
                  <p className="text-xs font-bold text-foreground">Save session progress</p>
                  <p className="text-[10px] text-muted-foreground">Restore your current card and retry pile next time</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={saveProgress}
                  onClick={() => setSaveProgress((current) => !current)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${saveProgress ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${saveProgress ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
            >
              Apply & Continue
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}

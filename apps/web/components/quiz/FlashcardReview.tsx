'use client';

import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Quiz, QuizQuestion } from '@quiz-creator/types';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Lightbulb,
  Maximize,
  Pencil,
  PenTool,
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  Star,
  Volume2,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getQuestionHint } from '@/lib/quizAnswerEvaluation';
import { quizAudio } from '@/lib/audio';
import { triggerCelebrationConfetti } from '@/lib/confetti';
import Modal from '@/components/ui/Modal';
import QuizQuestionFormModal from '@/components/quiz/QuizQuestionFormModal';
import WindFlameBadge from '@/components/quiz/WindFlameBadge';
import DrawableCanvas from '@/components/quiz/DrawableCanvas';
import { getQuizStreakRecord, recordSessionCompletion } from '@/lib/streakTracker';
import {
  completeQuizPerformanceSession,
  recordQuizPerformanceAnswer,
  resetQuizPerformanceSession
} from '@/lib/quizPerformance';
import RichTextContent from '@/components/editor/RichTextContent';
import { richTextToPlainText } from '@/lib/richText';

interface FlashcardReviewProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  shareToken?: string;
  subjectShareToken?: string;
  exitHref?: string;
  userId?: string;
}

interface CardToolbarProps {
  isStarred: boolean;
  isHintVisible?: boolean;
  isRetryCard?: boolean;
  onHint?: () => void;
  onEdit: () => void;
  onDrawMode: () => void;
  isDrawMode: boolean;
  onSpeak: () => void;
  canEdit: boolean;
}

function getAnswer(question: QuizQuestion, canViewAnswerKey: boolean = true): string {
  if (!canViewAnswerKey) {
    return 'The answer key is hidden by the author.';
  }
  return question.answer_text?.trim() || question.options[question.correct_answer]?.trim() || question.options[0]?.trim() || 'No answer provided.';
}

const SWIPE_EXIT_DURATION_MS = 400;
const SWIPE_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)';
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
  completedRounds?: number;
};

function shuffleList<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function getFlashcardSettingsKey(quizId: string, userId?: string): string {
  return userId ? `quiz-creator:flashcard-settings:${quizId}:${userId}` : `quiz-creator:flashcard-settings:${quizId}`;
}

function getFlashcardSessionKey(quizId: string, userId?: string): string {
  return userId ? `quiz-creator:flashcard-session:${quizId}:${userId}` : `quiz-creator:flashcard-session:${quizId}`;
}

function getFlashcardDrawingKey(quizId: string, questionId?: string, userId?: string): string {
  if (questionId) {
    return userId
      ? `quiz-creator:flashcard-drawing:${quizId}:${questionId}:${userId}`
      : `quiz-creator:flashcard-drawing:${quizId}:${questionId}`;
  }
  return userId ? `quiz-creator:flashcard-drawing:${quizId}:${userId}` : `quiz-creator:flashcard-drawing:${quizId}`;
}

function CardToolbar({ isStarred, isHintVisible, isRetryCard, onHint, onEdit, onDrawMode, isDrawMode, onSpeak, canEdit }: CardToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs font-semibold text-muted-foreground" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2">
        {onHint ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted hover:text-foreground"
            onClick={onHint}
          >
            <Lightbulb className={`h-4 w-4 ${isHintVisible ? 'text-amber-500 fill-amber-500/20' : 'text-primary'}`} />
            {isHintVisible ? 'Hide hint' : 'Get a hint'}
          </button>
        ) : null}
        {isRetryCard && (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            Let&apos;s try again
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onDrawMode}
          aria-label={isDrawMode ? 'Exit drawing mode' : 'Enable drawing mode'}
          aria-pressed={isDrawMode}
          title={isDrawMode ? 'Exit drawing mode' : 'Draw on this reviewer'}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
            isDrawMode
              ? 'border-primary bg-primary text-white shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <PenTool className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isDrawMode ? 'Drawing' : 'Draw'}</span>
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit question"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={onSpeak} aria-label="Read card aloud" className="text-muted-foreground transition-colors hover:text-foreground">
          <Volume2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function FlashcardReview({ quiz, questions, shareToken, subjectShareToken, exitHref, userId }: FlashcardReviewProps) {
  const router = useRouter();
  const sharedQuery = shareToken ? `&shareToken=${encodeURIComponent(shareToken)}` : '';
  const subjectLocator = quiz.subject?.slug || quiz.subject?.id;
  const resolvedExitHref = exitHref ?? (
    subjectLocator
      ? `/subjects/${encodeURIComponent(subjectLocator)}`
      : subjectShareToken
        ? `/subjects/share/${encodeURIComponent(subjectShareToken)}`
        : (shareToken ? '/library' : '/review')
  );
  const isOwner = Boolean(userId && quiz.user_id && quiz.user_id === userId);
  const isPublicView = Boolean(shareToken || subjectShareToken);
  const canEdit = !isPublicView || isOwner;
  const canViewAnswerKey = !isPublicView || isOwner || quiz.allow_public_answer_key === true;
  const [cardIndex, setCardIndex] = useState(0);
  const [cloning, setCloning] = useState(false);
  const [clonedSuccess, setClonedSuccess] = useState(false);
  const [isFlipped, setRawIsFlipped] = useState(false);
  const setIsFlipped = (next: Parameters<typeof setRawIsFlipped>[0]) => {
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
    setRawIsFlipped(next);
  };
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [trackProgress, setTrackProgress] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [cards, setCards] = useState(questions);
  const [incorrectIds, setIncorrectIds] = useState<string[]>([]);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [saveProgress, setSaveProgress] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditQuestionModal, setShowEditQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [hasSeenAnswer, setHasSeenAnswer] = useState(false);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true);
  const [streakStats, setStreakStats] = useState(() => getQuizStreakRecord(quiz.id));
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isExitTransitionActive, setIsExitTransitionActive] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const swipeOverlayRef = useRef<HTMLDivElement>(null);
  const swipeLeftLabelRef = useRef<HTMLSpanElement>(null);
  const swipeRightLabelRef = useRef<HTMLSpanElement>(null);
  const swipeFrameRef = useRef<number | null>(null);
  const pendingSwipeOffsetRef = useRef(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasSeenAnswerRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const swipeTimerRef = useRef<number | null>(null);
  const frontContentRef = useRef<HTMLDivElement>(null);
  const backContentRef = useRef<HTMLDivElement>(null);
  const lastReviewRefreshRef = useRef(Date.now());
  const performanceSessionIdRef = useRef(`flashcard-${quiz.id}-${userId || 'guest'}-${Date.now()}`);

  useEffect(() => {
    quizAudio.preload();
    const record = getQuizStreakRecord(quiz.id);
    if (record.allTimeBestStreak > 0) {
      setBestStreak(record.allTimeBestStreak);
    }
  }, [quiz.id]);

  useEffect(() => {
    const refreshReview = () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastReviewRefreshRef.current < 1000) return;
      lastReviewRefreshRef.current = now;
      router.refresh();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        refreshReview();
      }
    };

    window.addEventListener('focus', refreshReview);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', refreshReview);

    return () => {
      window.removeEventListener('focus', refreshReview);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', refreshReview);
    };
  }, [router]);

  useEffect(() => {
    setSessionHydrated(false);

    const defaultSettings: FlashcardSettings = {
      shuffleQuestions: false,
      saveProgress: true
    };
    let settings = defaultSettings;

    if (typeof window !== 'undefined') {
      try {
        const storedSettings = JSON.parse(window.localStorage.getItem(getFlashcardSettingsKey(quiz.id, userId)) || 'null') as Partial<FlashcardSettings> | null;
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
        const snapshot = JSON.parse(window.localStorage.getItem(getFlashcardSessionKey(quiz.id, userId)) || 'null') as FlashcardSessionSnapshot | null;
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
          setCompletedRounds(snapshot?.completedRounds || 0);
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
      setCompletedRounds(0);
      setIsCompleted(false);
      setIsFlipped(false);
      hasSeenAnswerRef.current = false;
      setHasSeenAnswer(false);
      setIsHintVisible(false);
    }

    setSessionHydrated(true);
  }, [quiz.id, questions, userId]);

  useEffect(() => {
    if (!sessionHydrated || typeof window === 'undefined') return;

    try {
      if (!saveProgress || isCompleted) {
        window.localStorage.removeItem(getFlashcardSessionKey(quiz.id, userId));
      } else {
        const snapshot: FlashcardSessionSnapshot = {
          version: FLASHCARD_SESSION_VERSION,
          cardIds: cards.map((card) => card.id),
          cardIndex,
          incorrectIds,
          isFlipped,
          hasSeenAnswer,
          completedRounds
        };
        window.localStorage.setItem(getFlashcardSessionKey(quiz.id, userId), JSON.stringify(snapshot));
      }

      window.localStorage.setItem(getFlashcardSettingsKey(quiz.id, userId), JSON.stringify({
        version: FLASHCARD_SETTINGS_VERSION,
        shuffleQuestions,
        saveProgress
      }));
    } catch {
      // Ignore storage restrictions and keep the in-memory session usable.
    }
  }, [quiz.id, sessionHydrated, saveProgress, shuffleQuestions, cards, cardIndex, incorrectIds, isFlipped, hasSeenAnswer, completedRounds, isCompleted, userId]);

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
  const isRetryCard = completedRounds > 0 || (currentCard ? incorrectIds.includes(currentCard.id) : false);
  const progress = useMemo(
    () => (cards.length > 0 ? ((cardIndex + 1) / cards.length) * 100 : 0),
    [cardIndex, cards.length]
  );
  function handleEditCurrentQuestion() {
    if (!currentCard) return;
    setEditingQuestion(currentCard);
    setShowEditQuestionModal(true);
  }

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

    const contentOpacity = offset === 0 ? '' : String(Math.max(0.08, 1 - progress * 0.92));
    if (frontContentRef.current) frontContentRef.current.style.opacity = contentOpacity;
    if (backContentRef.current) backContentRef.current.style.opacity = contentOpacity;
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
    if (retryCards.length === 0) {
      setIncorrectIds([]);
      setSwipeOffset(0);
      setIsCompleted(true);
      completeQuizPerformanceSession({
        quizId: quiz.id,
        mode: 'flashcard',
        sessionId: performanceSessionIdRef.current
      });
      if (typeof window !== 'undefined' && saveProgress) {
        try {
          window.localStorage.removeItem(getFlashcardSessionKey(quiz.id, userId));
        } catch {}
      }
      if (audioFeedbackEnabled) void quizAudio.playSuccessSound();
      triggerCelebrationConfetti();
      return;
    }

    setCards(shuffleQuestions ? shuffleList(retryCards) : [...retryCards]);
    setCompletedRounds((prev) => prev + 1);
    setCardIndex(0);
    setIsFlipped(false);
    hasSeenAnswerRef.current = false;
    setHasSeenAnswer(false);
    setIsHintVisible(false);
    setSwipeOffset(0);
    updateSwipeFeedback(0);
  }

  function handleRestartReview() {
    resetQuizPerformanceSession({
      quizId: quiz.id,
      mode: 'flashcard',
      sessionId: performanceSessionIdRef.current
    });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(getFlashcardSessionKey(quiz.id, userId));
      } catch {}
    }
    const nextCards = shuffleQuestions ? shuffleList(questions) : [...questions];
    setCards(nextCards);
    setCardIndex(0);
    setIncorrectIds([]);
    setCompletedRounds(0);
    setIsCompleted(false);
    setIsFlipped(false);
    hasSeenAnswerRef.current = false;
    setHasSeenAnswer(false);
    setIsHintVisible(false);
    setSwipeOffset(0);
    setStreak(0);
  }

  function handleCardPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isDrawMode) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, a, input, select')) return;

    cancelPendingSwipeFrame();
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    suppressClickRef.current = false;
    if (cardRef.current) {
      cardRef.current.style.transition = 'none';
    }
    setSwipeOffset(0);
    applySwipeVisual(0);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  }

  function handleCardPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (isDrawMode) return;
    const start = swipeStartRef.current;
    if (!start) return;

    const offsetX = event.clientX - start.x;
    if (Math.abs(offsetX) > 8) {
      suppressClickRef.current = true;
    }

    queueSwipeVisual(offsetX);
  }

  function handleCardPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (isDrawMode) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    }

    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    cancelPendingSwipeFrame();
    if (!start) return;

    const offsetX = event.clientX - start.x;
    setIsDragging(false);

    if (Math.abs(offsetX) < 90) {
      if (cardRef.current) {
        cardRef.current.style.transition = `transform 280ms ${SWIPE_EASING}`;
        cardRef.current.style.transform = '';
      }
      setSwipeOffset(0);
      updateSwipeFeedback(0);
      return;
    }

    const known = offsetX > 0;
    if (known && audioFeedbackEnabled) void quizAudio.playCorrectSound();
    suppressClickRef.current = true;
    const cardWidth = cardRef.current?.offsetWidth || 600;
    const exitDistance = Math.max((window.innerWidth + cardWidth) / 2 + 80, 600);
    const targetOffset = known ? exitDistance : -exitDistance;

    if (cardRef.current) {
      cardRef.current.style.transition = `transform ${SWIPE_EXIT_DURATION_MS}ms ${SWIPE_EASING}`;
      updateSwipeTransform(targetOffset);
    }
    setSwipeOffset(targetOffset);

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

  function handleCardPointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (isDrawMode) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    }
    cancelPendingSwipeFrame();
    swipeStartRef.current = null;
    setIsDragging(false);
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)';
      cardRef.current.style.transform = '';
    }
    setSwipeOffset(0);
    applySwipeVisual(0);
  }

  function toggleCard() {
    if (isDrawMode) return;
    setIsFlipped((current) => {
      if (!current) {
        hasSeenAnswerRef.current = true;
        setHasSeenAnswer(true);
      }
      return !current;
    });
  }

  function handleCardClick() {
    if (isDrawMode) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    toggleCard();
  }

  function recordCardResult(known: boolean) {
    if (!currentCard) return;

    recordQuizPerformanceAnswer({
      quizId: quiz.id,
      mode: 'flashcard',
      sessionId: performanceSessionIdRef.current,
      questionId: currentCard.id,
      isCorrect: known
    });

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
    resetQuizPerformanceSession({
      quizId: quiz.id,
      mode: 'flashcard',
      sessionId: performanceSessionIdRef.current
    });
    setShuffleQuestions(enabled);
    const nextCards = enabled ? shuffleList(questions) : [...questions];
    setCards(nextCards);
    setCardIndex(0);
    setIncorrectIds([]);
    setCompletedRounds(0);
    setIsCompleted(false);
    setIsFlipped(false);
    hasSeenAnswerRef.current = false;
    setHasSeenAnswer(false);
    setIsHintVisible(false);
  }

  async function handleClone() {
    if (!shareToken || !quiz.allow_cloning || cloning) return;
    setCloning(true);
    try {
      const res = await fetch(`/api/public/sets/${encodeURIComponent(shareToken)}/clone`, {
        method: 'POST'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to clone study set');
      }
      const cloned = await res.json();
      setClonedSuccess(true);
      setTimeout(() => {
        router.push(`/quizzes/${encodeURIComponent(cloned.slug || cloned.id)}`);
      }, 800);
    } catch (err: any) {
      alert(err.message || 'Could not clone study set.');
      setCloning(false);
    }
  }

  function speakCard() {
    if (!currentCard || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const textToSpeak = isFlipped
      ? richTextToPlainText(getAnswer(currentCard, canViewAnswerKey))
      : richTextToPlainText(currentCard.question_text);
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(textToSpeak));
  }

  function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  }

  if (isCompleted) {
    return (
      <div className="relative left-1/2 w-screen -translate-x-1/2 bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
        <div className="mx-auto max-w-xl text-center space-y-6">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5 mx-auto">
            <Sparkles className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              All flashcards mastered!
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You reviewed all {questions.length} cards and conquered every missed card.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-black text-foreground">{completedRounds + 1}</p>
              <p className="text-xs font-semibold text-muted-foreground">Rounds completed</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-black text-primary">{bestStreak}</p>
              <p className="text-xs font-semibold text-muted-foreground">Best streak</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRestartReview}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Review Again</span>
            </button>
            <Link
              href={`/practice/${encodeURIComponent(quiz.slug || quiz.id)}?mode=multiple_choice${sharedQuery}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-3.5 text-xs font-bold text-foreground transition-all hover:bg-muted active:scale-95"
            >
              <Layers className="h-4 w-4 text-primary" />
              <span>Practice Multiple Choice</span>
            </Link>
            <Link
              href={resolvedExitHref}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/20 px-6 py-3.5 text-xs font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
            >
              <X className="h-4 w-4" />
              <span>Exit review</span>
            </Link>
          </div>
        </div>
      </div>
    );
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
              href={resolvedExitHref}
              className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Exit review
            </Link>
            <h1 className="truncate text-lg font-bold text-foreground">Reviewer</h1>
            <p className="truncate text-xs text-muted-foreground">{quiz.title}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {shareToken && quiz.allow_cloning && (
              <button
                type="button"
                onClick={handleClone}
                disabled={cloning}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                  clonedSuccess
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                    : 'border-border bg-card hover:bg-muted text-foreground'
                }`}
                title="Save this reviewer deck to your library"
              >
                {clonedSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{cloning ? 'Saving...' : 'Save to Library'}</span>
                  </>
                )}
              </button>
            )}
            <WindFlameBadge
              streak={streak}
              totalQuestions={cards.length}
              bestStreak={bestStreak}
              size="md"
            />
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
            href={`/practice/${encodeURIComponent(quiz.slug || quiz.id)}?mode=identification${sharedQuery}`}
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PenTool className="h-6 w-6 text-primary" />
            Identification
          </Link>
          <Link
            href={`/practice/${encodeURIComponent(quiz.slug || quiz.id)}?mode=multiple_choice${sharedQuery}`}
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Layers className="h-6 w-6 text-primary" />
            Multiple Choice
          </Link>
        </div>

        <div className="relative">
          <div
            ref={cardRef}
          className={`perspective-1000 relative h-[430px] sm:h-[500px] ${isDrawMode ? 'cursor-text select-text' : 'cursor-pointer select-none'} ${isDrawMode ? 'touch-auto' : isDragging ? 'touch-none' : 'touch-pan-y'}`}
          onClick={handleCardClick}
          onPointerDown={handleCardPointerDown}
          onPointerMove={handleCardPointerMove}
          onPointerUp={handleCardPointerUp}
          onPointerCancel={handleCardPointerCancel}
          style={{
            transform: swipeOffset ? `translate3d(${swipeOffset}px, 0, 0) rotate(${swipeOffset / 12}deg)` : undefined,
            transition: isDragging ? 'none' : `transform ${SWIPE_EXIT_DURATION_MS}ms ${SWIPE_EASING}`,
            willChange: 'transform'
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (isDrawMode) {
              event.preventDefault();
              return;
            }
            if (event.key.toLowerCase() === 'h') {
              event.preventDefault();
              if (canViewAnswerKey) {
                setIsHintVisible((current) => !current);
              }
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleCard();
            }
          }}
          aria-label={isFlipped ? 'Show flashcard prompt' : 'Show flashcard answer'}
        >
          <div
            key={`${currentCard.id}-${cardIndex}-${completedRounds}`}
            className="h-full w-full flashcard-slide-in-bottom"
          >
            <div
              className={`relative h-full transform-style-3d transition-transform duration-500 ease-in-out ${isFlipped ? 'rotate-x-180' : ''}`}
            >
              <div className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm backface-hidden transition-shadow hover:border-primary/40 hover:shadow-md sm:p-7" aria-hidden={isFlipped}>
                <CardToolbar
                  onEdit={handleEditCurrentQuestion}
                  onDrawMode={() => setIsDrawMode((current) => !current)}
                  isDrawMode={isDrawMode}
                  isStarred={isStarred}
                  isHintVisible={isHintVisible}
                  isRetryCard={isRetryCard}
                  onHint={canViewAnswerKey ? () => setIsHintVisible((current) => !current) : undefined}
                  onSpeak={speakCard}
                  canEdit={canEdit}
                />
                <div
                  ref={frontContentRef}
                  className="flex min-h-0 flex-1 items-center justify-center overflow-hidden [overflow-wrap:anywhere] px-4 py-10 text-center transition-opacity duration-150"
                >
                  <div className="max-w-3xl space-y-4">
                    <RichTextContent
                      html={currentCard.question_text}
                      className="max-h-full max-w-3xl overflow-hidden break-words text-xl font-medium leading-snug text-foreground [overflow-wrap:anywhere] line-clamp-10 sm:text-2xl text-center"
                    />
                    {isHintVisible && canViewAnswerKey && (
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
                  onEdit={handleEditCurrentQuestion}
                  onDrawMode={() => setIsDrawMode((current) => !current)}
                  isDrawMode={isDrawMode}
                  isStarred={isStarred}
                  isRetryCard={isRetryCard}
                  onSpeak={speakCard}
                  canEdit={canEdit}
                />
                <div
                  ref={backContentRef}
                  className="flex min-h-0 flex-1 items-center justify-center overflow-hidden [overflow-wrap:anywhere] px-4 py-10 text-center transition-opacity duration-150"
                >
                  <div className="max-w-3xl space-y-4">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Answer</span>
                    <RichTextContent
                      html={getAnswer(currentCard, canViewAnswerKey)}
                      className="max-h-full max-w-3xl overflow-hidden break-words text-xl font-medium leading-snug text-primary [overflow-wrap:anywhere] line-clamp-8 sm:text-3xl text-center"
                    />
                    {canViewAnswerKey && currentCard.explanation && (
                      <RichTextContent
                        html={currentCard.explanation}
                        className="text-sm leading-relaxed text-muted-foreground line-clamp-3 text-center"
                      />
                    )}
                  </div>
                </div>
                <div className="text-center text-xs font-semibold text-muted-foreground">
                  Swipe left if you missed it · swipe right if you got it right
                </div>
                <div className="mt-3 flex items-center justify-center gap-3" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    disabled={isDrawMode}
                    onClick={() => {
                      completeCard(false);
                    }}
                    className="rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Still learning
                  </button>
                  <button
                    type="button"
                    disabled={isDrawMode}
                    onClick={() => {
                      completeCard(true);
                    }}
                    className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Got it right ✓
                  </button>
                </div>
              </div>
              <DrawableCanvas
                active={isDrawMode}
                containerRef={cardRef}
                storageKey={getFlashcardDrawingKey(quiz.id, currentCard?.id, userId)}
                onExit={() => setIsDrawMode(false)}
              />
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
          <div className="flex flex-col items-center">
            <span className="min-w-14 text-center text-sm font-bold text-foreground">
              {cardIndex + 1} / {cards.length}
            </span>
            {completedRounds > 0 && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                Retry round # {completedRounds + 1}
              </span>
            )}
          </div>
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

        <QuizQuestionFormModal
          open={showEditQuestionModal}
          onOpenChange={setShowEditQuestionModal}
          question={editingQuestion}
          quizId={quiz.id}
          onSaved={(savedQuestion) => {
            if (savedQuestion && savedQuestion.id) {
              setCards((prev) => prev.map((c) => (c.id === savedQuestion.id ? savedQuestion : c)));
            }
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}

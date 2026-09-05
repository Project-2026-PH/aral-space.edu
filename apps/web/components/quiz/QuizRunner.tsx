'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Quiz,
  QuizQuestion,
  QuizSession,
  QuestionProgress,
  QuizMode,
  ShuffledOption,
  PracticeSessionState,
  CardTelemetryRecord,
  SessionMasterySummary
} from '@quiz-creator/types';
import {
  MasteryEngineService,
  CognitiveMasteryQueue,
  QuizShuffleService,
  QuizTransformService,
  SessionTelemetryService,
  BATCH_SIZE
} from '@quiz-creator/core';
import {
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Shuffle,
  ChevronRight,
  Award,
  Layers,
  Volume2,
  VolumeX,
  AlertTriangle,
  Tag,
  Brain,
  Gauge,
  Check,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import Link from 'next/link';
import BatchRestTimer from './BatchRestTimer';
import { quizAudio } from '@/lib/audio';
import { triggerCelebrationConfetti } from '@/lib/confetti';

interface QuizRunnerProps {
  quiz: Quiz;
  initialQuestions: QuizQuestion[];
  initialSession: QuizSession;
  initialProgress: QuestionProgress[];
  mode: QuizMode;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

interface PendingQueueTransition {
  nextQueue: PracticeSessionState;
  progressMap: Map<string, QuestionProgress>;
  recapQuestionIds: string[];
}

const QUESTION_EXIT_DURATION_MS = 180;

function getQuestionAnswer(question: QuizQuestion): string {
  return question.answer_text?.trim() || question.options[question.correct_answer]?.trim() || '';
}

function normalizeTypedAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export default function QuizRunner({
  quiz,
  initialQuestions,
  initialSession,
  initialProgress,
  mode,
  shuffleQuestions = false,
  shuffleOptions = true
}: QuizRunnerProps) {
  const processedQuestions = useMemo(() => {
    // Build ephemeral choices only for modes that need them. Saved reviewer data
    // remains sparse, and this avoids one query or AI request per question.
    const optionReadyQuestions = mode === 'multiple_choice' || mode === 'reverse'
      ? QuizTransformService.prepareQuestionsForOptions(initialQuestions)
      : initialQuestions;

    return mode === 'reverse'
      ? QuizTransformService.generateReverseQuestions(optionReadyQuestions)
      : optionReadyQuestions;
  }, [initialQuestions, mode]);

  const [questions] = useState<QuizQuestion[]>(() => {
    if (shuffleQuestions) {
      return [...processedQuestions].sort(() => Math.random() - 0.5);
    }
    return processedQuestions;
  });

  const [session, setSession] = useState<QuizSession>(initialSession);
  const [progressMap, setProgressMap] = useState<Map<string, QuestionProgress>>(() => {
    return new Map(initialProgress.map((p) => [p.question_id, p]));
  });

  const [currentBatch, setCurrentBatch] = useState<number>(() => {
    const activeBatch = MasteryEngineService.getActiveBatchNumber(
      questions,
      new Map(initialProgress.map((p) => [p.question_id, p]))
    );
    return activeBatch >= 0 ? activeBatch : 0;
  });

  const [queueState, setQueueState] = useState<PracticeSessionState>(() => {
    const activeBatch = MasteryEngineService.getActiveBatchNumber(
      questions,
      new Map(initialProgress.map((p) => [p.question_id, p]))
    );
    const batchNum = activeBatch >= 0 ? activeBatch : 0;
    const batchQs = questions.filter(
      (q) => MasteryEngineService.getBatchNumber(q.order_index) === batchNum
    );
    const unlockedIds = batchQs.filter((q) => !initialProgress.find(p => p.question_id === q.id)?.locked).map((q) => q.id);
    return CognitiveMasteryQueue.initialize(unlockedIds);
  });

  const [accumulatedStruggleIds, setAccumulatedStruggleIds] = useState<string[]>([]);
  const [lastOutcome, setLastOutcome] = useState<'completed' | 'reinserted' | 'struggle_pile' | null>(null);
  const [isStruggleReviewMode, setIsStruggleReviewMode] = useState<boolean>(false);

  // Pre-Commitment Cognitive Delay ("Think First") state
  const [retrievalCountdown, setRetrievalCountdown] = useState<number>(3);
  const [isRetrievalPhase, setIsRetrievalPhase] = useState<boolean>(true);
  const [formulationThought, setFormulationThought] = useState<string>('');

  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluatedCardIds, setEvaluatedCardIds] = useState<string[]>([]);
  const [pendingAdvance, setPendingAdvance] = useState<PendingQueueTransition | null>(null);
  const [isRecapVisible, setIsRecapVisible] = useState<boolean>(false);
  const [isQuestionTransitioning, setIsQuestionTransitioning] = useState<boolean>(false);
  const [identificationInput, setIdentificationInput] = useState<string>('');
  const [identificationSubmitted, setIdentificationSubmitted] = useState<boolean>(false);
  const [typedAnswerCorrect, setTypedAnswerCorrect] = useState<boolean | null>(null);
  const [showRestTimer, setShowRestTimer] = useState<boolean>(false);
  const [restingCompletedBatch, setRestingCompletedBatch] = useState<number>(0);
  const [restingNextBatch, setRestingNextBatch] = useState<number>(1);
  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    return questions.length > 0 && MasteryEngineService.isAllQuestionsLocked(questions, new Map(initialProgress.map((p) => [p.question_id, p])));
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const celebrationFiredRef = useRef<boolean>(false);

  // Response Latency & Telemetry Tracking
  const questionStartTimeRef = useRef<number>(Date.now());
  const cardTelemetryRef = useRef<Record<string, CardTelemetryRecord>>({});
  const [cardTelemetry, setCardTelemetry] = useState<Record<string, CardTelemetryRecord>>({});
  const [sessionSummary, setSessionSummary] = useState<SessionMasterySummary | null>(null);
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const questionTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (questionTransitionTimeoutRef.current) {
        clearTimeout(questionTransitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsMuted(quizAudio.isMuted());
    quizAudio.preload();
    const unsub = quizAudio.subscribe((muted) => setIsMuted(muted));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isCompleted && !celebrationFiredRef.current) {
      celebrationFiredRef.current = true;
      quizAudio.playSuccessSound();
      triggerCelebrationConfetti();
    }
  }, [isCompleted]);

  useEffect(() => {
    if (isCompleted && !sessionSummary) {
      setSessionSummary(SessionTelemetryService.generateSessionSummary(cardTelemetryRef.current, questions));
    }
  }, [isCompleted]);

  useEffect(() => {
    if (isStruggleReviewMode) return;
    const batchQs = questions.filter(
      (q) => MasteryEngineService.getBatchNumber(q.order_index) === currentBatch
    );
    const unlockedIds = batchQs.filter((q) => !progressMap.get(q.id)?.locked).map((q) => q.id);
    setQueueState(CognitiveMasteryQueue.initialize(unlockedIds));
    setLastOutcome(null);
  }, [currentBatch, isStruggleReviewMode]);

  // Active question from CognitiveMasteryQueue
  const activeQuestionId = CognitiveMasteryQueue.getCurrentQuestionId(queueState);
  const activeQuestion = activeQuestionId
    ? questions.find((q) => q.id === activeQuestionId) || null
    : null;

  useEffect(() => {
    questionStartTimeRef.current = Date.now();
  }, [activeQuestion?.id]);

  const currentProg = activeQuestion ? progressMap.get(activeQuestion.id) : null;

  // Options for active question
  const [currentOptions, setCurrentOptions] = useState<ShuffledOption[]>([]);

  useEffect(() => {
    if (!activeQuestion) return;
    if (shuffleOptions) {
      setCurrentOptions(
        QuizShuffleService.shuffleOptions(
          activeQuestion.options,
          activeQuestion.correct_answer
        )
      );
    } else {
      setCurrentOptions(
        activeQuestion.options.map((text, idx) => ({
          optionId: idx,
          text,
          isCorrect: idx === activeQuestion.correct_answer
        }))
      );
    }
    setSelectedOptionId(null);
    setIsEvaluating(false);
    setIsCardFlipped(false);
    setIdentificationInput('');
    setIdentificationSubmitted(false);
    setTypedAnswerCorrect(null);
  }, [activeQuestion?.id]);

  // Pre-Commitment Cognitive Delay timer
  useEffect(() => {
    if (!activeQuestion) return;
    const isMultipleChoiceLike = mode === 'multiple_choice' || mode === 'reverse';
    if (!isMultipleChoiceLike || activeQuestion.options.length < 2) {
      setIsRetrievalPhase(false);
      setRetrievalCountdown(0);
      return;
    }

    setIsRetrievalPhase(true);
    setRetrievalCountdown(3);
    setFormulationThought('');

    const timer = setInterval(() => {
      setRetrievalCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRetrievalPhase(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeQuestion?.id, mode]);

  function handleSkipDelay() {
    setIsRetrievalPhase(false);
    setRetrievalCountdown(0);
  }

  function startStrugglePileReview() {
    if (accumulatedStruggleIds.length === 0) return;
    setIsCompleted(false);
    celebrationFiredRef.current = false;
    setIsStruggleReviewMode(true);
    setQueueState(CognitiveMasteryQueue.initialize(accumulatedStruggleIds));
  }

  function handleOptionSelect(option: ShuffledOption) {
    if (isEvaluating || !activeQuestion || !currentProg) return;

    setIsEvaluating(true);
    setSelectedOptionId(option.optionId);

    const isCorrect = option.isCorrect;
    const latencyMs = Math.max(1, Date.now() - questionStartTimeRef.current);
    const qId = activeQuestion.id;
    const prevRec = cardTelemetryRef.current[qId];
    const isFirstPass = !prevRec;
    const firstPassCorrect = isFirstPass ? isCorrect : prevRec.firstPassCorrect;
    const totalAttempts = (prevRec?.totalAttempts || 0) + 1;
    const totalMisses = (prevRec?.totalMisses || 0) + (isCorrect ? 0 : 1);
    const timeToCorrectMs = isCorrect ? latencyMs : prevRec?.timeToCorrectMs;
    const latenciesMs = [...(prevRec?.latenciesMs || []), latencyMs];
    const resolvedTags = activeQuestion.concept_tags && activeQuestion.concept_tags.length > 0
      ? activeQuestion.concept_tags
      : (activeQuestion.discriminatory_keywords && activeQuestion.discriminatory_keywords.length > 0
        ? activeQuestion.discriminatory_keywords
        : ['general']);

    const updatedRec: CardTelemetryRecord = {
      questionId: qId,
      firstPassCorrect,
      totalAttempts,
      totalMisses,
      timeToCorrectMs,
      conceptTags: resolvedTags,
      latenciesMs
    };

    const nextTelemetry = {
      ...cardTelemetryRef.current,
      [qId]: updatedRec
    };
    cardTelemetryRef.current = nextTelemetry;
    setCardTelemetry(nextTelemetry);

    if (isCorrect) {
      quizAudio.playCorrectSound();
    }
    const nextProgData = MasteryEngineService.calculateNextProgress(
      currentProg,
      isCorrect,
      session.session_type
    );

    const updatedProg: QuestionProgress = {
      ...currentProg,
      ...nextProgData
    };

    const nextMap = new Map(progressMap);
    nextMap.set(activeQuestion.id, updatedProg);
    setProgressMap(nextMap);

    // Active Error Queue transition: 3-position reinsertion on miss, 3-miss struggle pile cap
    const queueResult = CognitiveMasteryQueue.recordResult(
      queueState,
      activeQuestion.id,
      isCorrect,
      { reinsertOffset: 3, maxAttempts: 3, windowSize: 7 }
    );
    setLastOutcome(queueResult.outcome);

    if (queueResult.outcome === 'struggle_pile') {
      setAccumulatedStruggleIds((prev) => Array.from(new Set([...prev, activeQuestion.id])));
    }

    // Keep the queue transition ready while feedback remains visible. A recap is
    // triggered by seven distinct evaluated cards, independently of the queue window.
    const nextEvaluatedCardIds = evaluatedCardIds.includes(qId)
      ? evaluatedCardIds
      : [...evaluatedCardIds, qId];
    const recapQuestionIds = nextEvaluatedCardIds.length >= 7
      ? nextEvaluatedCardIds.slice(0, 7)
      : [];

    setEvaluatedCardIds(recapQuestionIds.length > 0 ? [] : nextEvaluatedCardIds);
    setPendingAdvance({
      nextQueue: queueResult.nextState,
      progressMap: nextMap,
      recapQuestionIds
    });

    // Save to API without making the user wait before they can advance.
    void fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'answer',
        sessionId: session.id,
        questionId: activeQuestion.id,
        isCorrect,
        sessionType: session.session_type,
        latencyMs
      })
    }).catch((err) => {
      console.warn('Failed to sync progress:', err);
    });
  }

  function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && Boolean(
      target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]')
    );
  }

  function advanceFromSurface() {
    if (!pendingAdvance) return;

    if (isRecapVisible) {
      const transition = pendingAdvance;
      setIsRecapVisible(false);
      setPendingAdvance(null);
      setEvaluatedCardIds([]);
      advanceLoop(transition.nextQueue, transition.progressMap);
      return;
    }

    if (pendingAdvance.recapQuestionIds.length > 0) {
      setIsRecapVisible(true);
      return;
    }

    if (isQuestionTransitioning) return;

    const transition = pendingAdvance;
    setIsQuestionTransitioning(true);
    questionTransitionTimeoutRef.current = setTimeout(() => {
      questionTransitionTimeoutRef.current = null;
      setPendingAdvance(null);
      advanceLoop(transition.nextQueue, transition.progressMap);
      setIsQuestionTransitioning(false);
    }, QUESTION_EXIT_DURATION_MS);
  }

  function handleSurfaceClick(event: React.MouseEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return;
    advanceFromSurface();
  }

  function handleSurfaceKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      advanceFromSurface();
    }
  }

  function handleTypedAnswerSubmit() {
    if (isEvaluating || !activeQuestion || !currentProg || !identificationInput.trim()) return;

    const expectedAnswer = getQuestionAnswer(activeQuestion);
    const isCorrect = normalizeTypedAnswer(identificationInput) === normalizeTypedAnswer(expectedAnswer);
    setTypedAnswerCorrect(isCorrect);
    setIdentificationSubmitted(true);
    void handleOptionSelect({
      optionId: activeQuestion.correct_answer,
      text: identificationInput,
      isCorrect
    });
  }

  function advanceLoop(nextQueue: PracticeSessionState, map: Map<string, QuestionProgress>) {
    setIsEvaluating(false);
    setSelectedOptionId(null);
    setQueueState(nextQueue);

    if (CognitiveMasteryQueue.isRoundFinished(nextQueue)) {
      if (isStruggleReviewMode) {
        setIsStruggleReviewMode(false);
        handleCompleteQuiz();
        return;
      }

      // Check if entire quiz is complete
      if (MasteryEngineService.isAllQuestionsLocked(questions, map)) {
        handleCompleteQuiz();
        return;
      }

      // Advance to next batch
      const nextBatchNum = MasteryEngineService.getActiveBatchNumber(questions, map);
      if (nextBatchNum === -1) {
        handleCompleteQuiz();
      } else {
        setRestingCompletedBatch(currentBatch);
        setRestingNextBatch(nextBatchNum);
        setShowRestTimer(true);
      }
    }
  }

  async function handleCompleteQuiz() {
    setIsCompleted(true);
    const summary = SessionTelemetryService.generateSessionSummary(cardTelemetryRef.current, questions);
    setSessionSummary(summary);

    if (!celebrationFiredRef.current) {
      celebrationFiredRef.current = true;
      quizAudio.playSuccessSound();
      triggerCelebrationConfetti();
    }
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          sessionId: session.id,
          quizId: quiz.id,
          summary
        })
      });
    } catch (err) {
      console.warn('Session complete sync error:', err);
    }
  }

  if (isCompleted) {
    const summary = sessionSummary || SessionTelemetryService.generateSessionSummary(cardTelemetryRef.current, questions);
    const deckMedianSec = (summary.deckMedianLatencyMs / 1000).toFixed(1);
    const hesitationThresholdSec = ((summary.deckMedianLatencyMs * 1.5) / 1000).toFixed(1);

    const conceptEntries = Object.entries(summary.conceptErrorDensity).sort((a, b) => b[1] - a[1]);
    const reviewTopicCount = conceptEntries.filter(([_, misses]) => misses > 0).length;
    const firstPassMasteryScore = questions.length > 0
      ? Math.round((summary.buckets.green.length / questions.length) * 100)
      : 100;

    return (
      <div className="max-w-2xl mx-auto py-10 px-4 space-y-6 animate-fade-in text-center">
        {/* Completion Header */}
        <div className="space-y-3">
          <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-500 shadow-sm ring-1 ring-emerald-500/20">
            <Award className="h-10 w-10" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-2xl font-black text-foreground tracking-tight">Reviewer Mastery</h2>
            <p className="text-xs text-muted-foreground">Your Performance Breakdown</p>
          </div>
        </div>

        {/* Cognitive Intelligence Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs text-center space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Typical Speed
            </span>
            <p className="text-xl font-black text-foreground">{deckMedianSec}s</p>
            <p className="text-[10px] text-muted-foreground">per Question</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs text-center space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1">
              <Gauge className="h-3.5 w-3.5 text-amber-500" />
              Longest Pause
            </span>
            <p className="text-xl font-black text-amber-500">&gt; {hesitationThresholdSec}s</p>
            <p className="text-[10px] text-muted-foreground">Slower than your usual pace</p>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-border/80 bg-card p-4 shadow-2xs text-center space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1">
              <Brain className="h-3.5 w-3.5 text-emerald-500" />
              First-Try Mastery
            </span>
            <p className="text-xl font-black text-emerald-500">{firstPassMasteryScore}%</p>
            <p className="text-[10px] text-muted-foreground">Answers on first try</p>
          </div>
        </div>

        {/* Objective Mastery Tiering (Red / Yellow / Green) */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              <span>Objective Mastery Tiering</span>
            </h3>
            <span className="text-[11px] text-muted-foreground font-medium">
              {questions.length} cards categorized
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Green Bucket */}
            <div
              onClick={() => setActiveTelemetryTab(activeTelemetryTab === 'green' ? 'all' : 'green')}
              className={`cursor-pointer rounded-2xl border p-3 text-center transition-all ${activeTelemetryTab === 'green'
                ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                }`}
            >
              <div className="flex items-center justify-center gap-1 text-emerald-600 font-bold text-xs">
                <span>Got it</span>
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-1">{summary.buckets.green.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Answers on first try</p>
            </div>

            {/* Yellow Bucket */}
            <div
              onClick={() => setActiveTelemetryTab(activeTelemetryTab === 'yellow' ? 'all' : 'yellow')}
              className={`cursor-pointer rounded-2xl border p-3 text-center transition-all ${activeTelemetryTab === 'yellow'
                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
                }`}
            >
              <div className="flex items-center justify-center gap-1 text-amber-600 font-bold text-xs">
                <span>Needs Practice</span>
              </div>
              <p className="text-2xl font-black text-amber-600 mt-1">{summary.buckets.yellow.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Slow or took a second try</p>
            </div>

            {/* Red Bucket */}
            <div
              onClick={() => setActiveTelemetryTab(activeTelemetryTab === 'red' ? 'all' : 'red')}
              className={`cursor-pointer rounded-2xl border p-3 text-center transition-all ${activeTelemetryTab === 'red'
                ? 'border-destructive bg-destructive/10 ring-2 ring-destructive/30'
                : 'border-destructive/30 bg-destructive/5 hover:border-destructive/50'
                }`}
            >
              <div className="flex items-center justify-center gap-1 text-destructive font-bold text-xs">
                <span>Keep Studying</span>
              </div>
              <p className="text-2xl font-black text-destructive mt-1">{summary.buckets.red.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Missed more than once</p>
            </div>
          </div>

          {/* Filtered Cards List */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Card Breakdown {activeTelemetryTab !== 'all' ? `(${activeTelemetryTab.toUpperCase()})` : ''}</span>
              {activeTelemetryTab !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveTelemetryTab('all')}
                  className="text-primary hover:underline"
                >
                  Show all
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {questions
                .filter((q) => {
                  if (activeTelemetryTab === 'green') return summary.buckets.green.includes(q.id);
                  if (activeTelemetryTab === 'yellow') return summary.buckets.yellow.includes(q.id);
                  if (activeTelemetryTab === 'red') return summary.buckets.red.includes(q.id);
                  return true;
                })
                .map((q) => {
                  const rec = cardTelemetry[q.id] || cardTelemetryRef.current[q.id];
                  const bucket = summary.buckets.green.includes(q.id)
                    ? 'green'
                    : summary.buckets.yellow.includes(q.id)
                      ? 'yellow'
                      : 'red';
                  const latencySec = rec?.timeToCorrectMs
                    ? (rec.timeToCorrectMs / 1000).toFixed(1) + 's'
                    : (rec?.latenciesMs?.[0] ? (rec.latenciesMs[0] / 1000).toFixed(1) + 's' : '—');
                  const isHesitant = rec && rec.firstPassCorrect && SessionTelemetryService.isHesitant((rec.latenciesMs?.[0] || rec.timeToCorrectMs || 0), summary.deckMedianLatencyMs);

                  return (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-left space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground line-clamp-2">
                          {q.question_text}
                        </p>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {bucket === 'green' && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                              <span>✓ Got it ({latencySec})</span>
                            </span>
                          )}
                          {bucket === 'yellow' && (
                            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                              <span>🟡</span> {isHesitant ? `Hesitant (${latencySec})` : 'Recovered'}
                            </span>
                          )}
                          {bucket === 'red' && (
                            <span className="rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive flex items-center gap-1">
                              <span>🔴</span> At-Risk ({rec?.totalMisses || 0} misses)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Concept Tags */}
                      {q.concept_tags && q.concept_tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {q.concept_tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Topics to Review */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-primary" />
              <span>Topics to Review</span>
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {reviewTopicCount > 0
                ? `${reviewTopicCount} topic${reviewTopicCount > 1 ? 's' : ''} to review`
                : 'Nothing to review — nice work!'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {conceptEntries.map(([tag, misses]) => {
              const displayTag = tag === 'general' ? 'All Topics' : `#${tag}`;
              if (misses > 0) {
                return (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{displayTag}</span>
                    <span className="rounded-full bg-destructive/20 px-1.5 py-0.2 text-[10px]">
                      {misses} miss{misses > 1 ? 'es' : ''}
                    </span>
                  </span>
                );
              }
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-semibold text-emerald-600"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{displayTag}</span>
                </span>
              );
            })}
          </div>
        </div>

        {accumulatedStruggleIds.length > 0 && (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5 text-left space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-xs font-bold text-foreground">Anti-Fatigue Struggle Pile</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {accumulatedStruggleIds.length} card{accumulatedStruggleIds.length > 1 ? 's' : ''} missed 3 attempts and {accumulatedStruggleIds.length > 1 ? 'were' : 'was'} moved to the Struggle Pile to prevent burnout.
            </p>
            <button
              type="button"
              onClick={startStrugglePileReview}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Review Struggle Pile Now ({accumulatedStruggleIds.length})</span>
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* <button
            type="button"
            onClick={() => {
              quizAudio.playSuccessSound();
              triggerCelebrationConfetti();
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-5 py-3 text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95 shadow-2xs"
            title="Replay Celebration"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Celebrate Again</span>
          </button> */}
          {accumulatedStruggleIds.length > 0 && (
            <button
              type="button"
              onClick={startStrugglePileReview}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-6 py-3 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95 shadow-sm"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Review Struggle Pile ({accumulatedStruggleIds.length})</span>
            </button>
          )}
          <Link
            href={`/quizzes/${quiz.id}`}
            className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95"
          >
            Back to Overview
          </Link>
          <Link
            href="/quizzes"
            className="rounded-2xl border border-border bg-card px-6 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-95"
          >
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  if (isRecapVisible && pendingAdvance) {
    const recapQuestions = pendingAdvance.recapQuestionIds
      .map((questionId) => questions.find((question) => question.id === questionId))
      .filter((question): question is QuizQuestion => Boolean(question));

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleSurfaceClick}
        onKeyDown={handleSurfaceKeyDown}
        aria-label="Seven-card recap. Tap anywhere to continue."
        className="max-w-3xl mx-auto space-y-6 pb-20 outline-none cursor-pointer"
      >
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
            <BookOpen className="h-7 w-7" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Quick Recap</p>
          <h2 className="mt-1 text-2xl font-black text-foreground">Seven cards to remember</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Review the terms and definitions, then tap anywhere to continue.
          </p>
        </div>

        <div className="space-y-3">
          {recapQuestions.map((question, index) => (
            <div
              key={question.id}
              className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:items-start sm:gap-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {index + 1}. Term
                  </span>
                  <p className="mt-1 text-sm font-bold leading-relaxed text-foreground">
                    {question.question_text}
                  </p>
                </div>
                <div className="border-t border-border/60 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Definition</span>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
                    {getQuestionAnswer(question) || 'No definition provided.'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
          <ChevronRight className="h-4 w-4 animate-pulse text-primary" />
          <span>Tap anywhere to continue</span>
          <ChevronRight className="h-4 w-4 animate-pulse text-primary" />
        </div>
      </div>
    );
  }

  if (!activeQuestion) {
    return (
      <div className="max-w-md mx-auto py-12 text-center text-xs text-muted-foreground">
        Loading mastery session...
      </div>
    );
  }

  const totalLockedCount = questions.filter((q) => progressMap.get(q.id)?.locked).length;
  const overallPercent = Math.round((totalLockedCount / questions.length) * 100);

  return (
    <div
      className="max-w-3xl mx-auto space-y-6 pb-20"
      onClick={handleSurfaceClick}
      onKeyDown={handleSurfaceKeyDown}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/quizzes/${quiz.id}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Exit Session
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => quizAudio.toggleMute()}
            className="p-1.5 rounded-full border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {isStruggleReviewMode ? (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-500">
              Struggle Pile Review
            </span>
          ) : (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Batch #{currentBatch + 1}
            </span>
          )}
          {accumulatedStruggleIds.length > 0 && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{accumulatedStruggleIds.length} in Struggle Pile</span>
            </span>
          )}
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            {totalLockedCount} / {questions.length} Mastered
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${overallPercent}%` }}
        />
      </div>

      {/* Main Question Card */}
      <div className="overflow-hidden">
        <div
          key={activeQuestion.id}
          className={isQuestionTransitioning ? 'quiz-question-card-exit' : 'quiz-question-card-enter'}
        >
          {mode === 'learn' || ((mode === 'multiple_choice' || mode === 'reverse') && activeQuestion.options.length < 2) ? (
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-6">
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>{mode === 'learn' ? 'Learn Mode · Type the answer' : 'Not enough choices · Type the answer'}</span>
              {currentProg && currentProg.streak_count > 0 && (
                <span className="text-primary font-extrabold">Streak: {currentProg.streak_count}</span>
              )}
            </div>
            <p className="text-sm sm:text-base font-bold text-foreground mt-1 leading-relaxed">
              {activeQuestion.question_text}
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              autoFocus
              placeholder="Type your answer..."
              value={identificationInput}
              onChange={(event) => setIdentificationInput(event.target.value)}
              disabled={isEvaluating}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleTypedAnswerSubmit();
              }}
              className={`w-full rounded-2xl border bg-background px-4 py-3 text-sm font-medium text-foreground focus:outline-none ${typedAnswerCorrect === true
                ? 'border-emerald-500 ring-1 ring-emerald-500'
                : typedAnswerCorrect === false
                  ? 'border-destructive ring-1 ring-destructive'
                  : 'border-border focus:border-primary'
                }`}
            />
            <button
              type="button"
              onClick={handleTypedAnswerSubmit}
              disabled={isEvaluating || !identificationInput.trim()}
              className="w-full rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check Answer
            </button>
          </div>

          {identificationSubmitted && (
            <div className={`rounded-2xl border p-4 text-xs space-y-2 ${typedAnswerCorrect
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-destructive/30 bg-destructive/10'
              }`}>
              <div className="flex items-center gap-2 font-bold">
                {typedAnswerCorrect ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span>{typedAnswerCorrect ? 'Correct answer' : 'Keep practicing'}</span>
              </div>
              <p className="text-foreground">
                Correct answer: <span className="font-bold">{getQuestionAnswer(activeQuestion)}</span>
              </p>
              {!typedAnswerCorrect && (
                <p className="text-muted-foreground">Your answer: {identificationInput}</p>
              )}
              {activeQuestion.explanation && (
                <p className="text-muted-foreground italic">💡 {activeQuestion.explanation}</p>
              )}
            </div>
          )}
        </div>
      ) : mode === 'flashcard' ? (
        // 3D Flip Flashcard Mode
        <div
          onClick={() => setIsCardFlipped(!isCardFlipped)}
          className="perspective-1000 cursor-pointer min-h-[320px]"
        >
          <div
            className={`relative w-full h-full rounded-3xl border border-border/80 bg-card p-8 shadow-sm transition-transform duration-500 transform-style-3d ${isCardFlipped ? 'rotate-y-180' : ''
              }`}
          >
            {/* Front */}
            <div className={`space-y-4 backface-hidden ${isCardFlipped ? 'hidden' : 'block'}`}>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Prompt (Click to Flip)</span>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-bold text-foreground leading-relaxed">
                {activeQuestion.question_text}
              </p>
            </div>

            {/* Back */}
            <div className={`space-y-4 backface-hidden rotate-y-180 ${!isCardFlipped ? 'hidden' : 'block'}`}>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Answer & Explanation</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-base font-bold text-primary">
                {getQuestionAnswer(activeQuestion)}
              </p>
              {activeQuestion.explanation && (
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  💡 {activeQuestion.explanation}
                </p>
              )}

              <div className="pt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() =>
                    handleOptionSelect({
                      optionId: activeQuestion.correct_answer,
                      text: getQuestionAnswer(activeQuestion),
                      isCorrect: true
                    })
                  }
                  className="flex-1 rounded-2xl bg-emerald-500 py-3 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
                >
                  I Got It Right
                </button>
                <button
                  onClick={() =>
                    handleOptionSelect({
                      optionId: (activeQuestion.correct_answer + 1) % 4,
                      text: 'incorrect',
                      isCorrect: false
                    })
                  }
                  className="flex-1 rounded-2xl bg-muted py-3 text-xs font-bold text-foreground hover:bg-muted/80 transition-all active:scale-95"
                >
                  Need Review
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : mode === 'identification' ? (
        // Direct Identification Mode
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Identification Prompt
            </span>
            <p className="text-sm font-bold text-foreground mt-1 leading-relaxed">
              {activeQuestion.question_text}
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Type exact answer..."
              value={identificationInput}
              onChange={(e) => setIdentificationInput(e.target.value)}
              disabled={isEvaluating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && identificationInput.trim()) {
                  const correctText = getQuestionAnswer(activeQuestion);
                  const isCorrect =
                    identificationInput.trim().toLowerCase() === correctText.trim().toLowerCase();
                  setIdentificationSubmitted(true);
                  handleOptionSelect({
                    optionId: activeQuestion.correct_answer,
                    text: identificationInput,
                    isCorrect
                  });
                }
              }}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            />

            {identificationSubmitted && (
              <div className="rounded-2xl bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-bold text-foreground">
                  Correct Answer: {getQuestionAnswer(activeQuestion)}
                </p>
                {activeQuestion.explanation && (
                  <p className="text-muted-foreground text-[11px]">💡 {activeQuestion.explanation}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Standard Multiple Choice Mode & Reverse Mode
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-6">
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              <span>Question Prompt</span>
              {currentProg && currentProg.streak_count > 0 && (
                <span className="text-primary font-extrabold">Streak: {currentProg.streak_count}</span>
              )}
            </div>
            <p className="text-sm sm:text-base font-bold text-foreground leading-relaxed">
              {activeQuestion.question_text}
            </p>
          </div>

          {isRetrievalPhase ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/20 text-primary font-black text-sm shrink-0 animate-pulse">
                    {retrievalCountdown}s
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Brain className="h-4 w-4 text-primary" />
                      <span>Think First · Pre-Commitment Delay</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Retrieve the rule or concept from memory before scanning distractors.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSkipDelay}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors"
                >
                  <span>Reveal Options Now</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Optional: formulate your mental hypothesis before options appear..."
                  value={formulationThought}
                  onChange={(e) => setFormulationThought(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSkipDelay();
                  }}
                  className="w-full rounded-xl border border-border/80 bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Press Enter or click Reveal to skip countdown.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {formulationThought.trim() && (
                <div className="rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2 text-xs flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">Your initial formulation:</span>
                  <span className="font-semibold text-foreground italic">&ldquo;{formulationThought}&rdquo;</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentOptions.map((opt, idx) => {
                  const isSelected = selectedOptionId === opt.optionId;
                  let style = 'border-border bg-background/50 hover:border-primary/50 hover:bg-card';

                  if (isEvaluating) {
                    if (opt.isCorrect) {
                      style = 'border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500';
                    } else if (isSelected && !opt.isCorrect) {
                      style = 'border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(opt)}
                      disabled={isEvaluating}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all active:scale-98 ${style}`}
                    >
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-muted text-xs font-bold uppercase shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-xs font-semibold text-foreground pt-0.5 leading-snug">
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isEvaluating && (
            <div className="space-y-3 pt-2 animate-fade-in">
              {/* Correct Explanation & Principle */}
              {(activeQuestion.correct_explanation || activeQuestion.explanation) && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Principle & Explanation:</span>
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {activeQuestion.correct_explanation || activeQuestion.explanation}
                  </p>
                </div>
              )}

              {/* Distractor Fallacy Explanation */}
              {selectedOptionId !== null &&
                selectedOptionId !== activeQuestion.correct_answer &&
                activeQuestion.distractor_explanations?.[selectedOptionId] && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span>
                        Why Choice {String.fromCharCode(65 + currentOptions.findIndex((o) => o.optionId === selectedOptionId))} is Incorrect:
                      </span>
                    </div>
                    <p className="text-foreground leading-relaxed">
                      {activeQuestion.distractor_explanations[selectedOptionId]}
                    </p>
                  </div>
                )}

              {/* Discriminatory Keywords */}
              {activeQuestion.discriminatory_keywords && activeQuestion.discriminatory_keywords.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    Key Discriminators:
                  </span>
                  {activeQuestion.discriminatory_keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {/* Outcome Queue Indicator */}
              {lastOutcome === 'reinserted' && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-500">
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Leitner Reinsertion: Question reinserted 3 positions ahead in the active error queue.</span>
                </div>
              )}
              {lastOutcome === 'struggle_pile' && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Anti-Fatigue Guardrail: 3 misses reached. Question moved to Struggle Pile.</span>
                </div>
              )}
            </div>
          )}
        </div>
        )}
        </div>
      </div>

      {pendingAdvance && !isRecapVisible && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary animate-fade-in">
          <span>{pendingAdvance.recapQuestionIds.length > 0 ? 'Tap anywhere to open your seven-card recap' : 'Tap anywhere when you are ready for the next question'}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      )}

      {showRestTimer && (
        <BatchRestTimer
          completedBatch={restingCompletedBatch}
          nextBatch={restingNextBatch}
          onContinue={() => {
            setShowRestTimer(false);
            setCurrentBatch(restingNextBatch);
            const nextBatchQs = questions.filter(
              (q) => MasteryEngineService.getBatchNumber(q.order_index) === restingNextBatch
            );
            const unlockedIds = nextBatchQs.filter((q) => !progressMap.get(q.id)?.locked).map((q) => q.id);
            setQueueState(CognitiveMasteryQueue.initialize(unlockedIds));
          }}
        />
      )}
    </div>
  );
}

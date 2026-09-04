'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Quiz,
  QuizQuestion,
  QuizSession,
  QuestionProgress,
  QuizMode,
  ShuffledOption,
  PracticeSessionState
} from '@quiz-creator/types';
import {
  MasteryEngineService,
  CognitiveMasteryQueue,
  QuizShuffleService,
  QuizTransformService,
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
  Brain
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
  // Process questions based on mode
  const processedQuestions = mode === 'reverse'
    ? QuizTransformService.generateReverseQuestions(initialQuestions)
    : initialQuestions;

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

  async function handleOptionSelect(option: ShuffledOption) {
    if (isEvaluating || !activeQuestion || !currentProg) return;

    setIsEvaluating(true);
    setSelectedOptionId(option.optionId);

    const isCorrect = option.isCorrect;
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

    // Save to API
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          sessionId: session.id,
          questionId: activeQuestion.id,
          isCorrect,
          sessionType: session.session_type
        })
      });
    } catch (err) {
      console.warn('Failed to sync progress:', err);
    }

    const delayMs = mode === 'flashcard'
      ? 600
      : (activeQuestion.correct_explanation || activeQuestion.distractor_explanations || activeQuestion.explanation ? 1800 : 1200);

    setTimeout(() => {
      advanceLoop(queueResult.nextState, nextMap);
    }, delayMs);
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
          quizId: quiz.id
        })
      });
    } catch (err) {
      console.warn('Session complete sync error:', err);
    }
  }

  if (isCompleted) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6 animate-fade-in">
        <div className="inline-flex p-5 rounded-full bg-emerald-500/10 text-emerald-500">
          <Award className="h-12 w-12" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">Session Completed!</h2>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
            All {questions.length} questions in &quot;{quiz.title}&quot; were successfully mastered in this loop.
          </p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Session Mode:</span>
            <span className="font-bold text-foreground capitalize">{mode.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Mastery Score:</span>
            <span className="font-bold text-emerald-500">
              {questions.length > 0 ? Math.round(((questions.length - accumulatedStruggleIds.length) / questions.length) * 100) : 100}% Mastered
            </span>
          </div>
          {accumulatedStruggleIds.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Struggle Pile:</span>
              <span className="font-bold text-amber-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {accumulatedStruggleIds.length} Flagged for Targeted Review
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Next Review:</span>
            <span className="font-bold text-primary">In 24 Hours</span>
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

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
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
          </button>
          <button
            type="button"
            onClick={() => quizAudio.toggleMute()}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 shadow-2xs"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span>{isMuted ? 'Sound Muted' : 'Sound On'}</span>
          </button>
          <Link
            href={`/quizzes/${quiz.id}`}
            className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            Back to Quiz Overview
          </Link>
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
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
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
      {mode === 'learn' || (mode === 'multiple_choice' && activeQuestion.options.length < 2) ? (
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-6">
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>{mode === 'learn' ? 'Learn Mode · Type the answer' : 'No choices · Type the answer'}</span>
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
              className={`w-full rounded-2xl border bg-background px-4 py-3 text-sm font-medium text-foreground focus:outline-none ${
                typedAnswerCorrect === true
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
            <div className={`rounded-2xl border p-4 text-xs space-y-2 ${
              typedAnswerCorrect
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
            className={`relative w-full h-full rounded-3xl border border-border/80 bg-card p-8 shadow-sm transition-transform duration-500 transform-style-3d ${
              isCardFlipped ? 'rotate-y-180' : ''
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

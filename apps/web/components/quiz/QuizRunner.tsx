'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Quiz, QuizQuestion, QuizSession, QuestionProgress, QuizMode, ShuffledOption } from '@quiz-creator/types';
import { MasteryEngineService, QuizShuffleService, QuizTransformService, BATCH_SIZE } from '@quiz-creator/core';
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
  VolumeX
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
  const [cycleIndex, setCycleIndex] = useState<number>(0);
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

  // Active batch questions
  const batchQuestions = questions.filter(
    (q) => MasteryEngineService.getBatchNumber(q.order_index) === currentBatch
  );
  const unlockedInBatch = batchQuestions.filter((q) => !progressMap.get(q.id)?.locked);

  const activeQuestion = unlockedInBatch.length > 0
    ? unlockedInBatch[cycleIndex % unlockedInBatch.length]
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
  }, [activeQuestion?.id, cycleIndex]);

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

    setTimeout(() => {
      advanceLoop(nextMap, updatedProg.locked);
    }, mode === 'flashcard' ? 600 : 1000);
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

  function advanceLoop(map: Map<string, QuestionProgress>, wasLocked: boolean) {
    setIsEvaluating(false);
    setSelectedOptionId(null);

    // Check if entire quiz is complete
    if (MasteryEngineService.isAllQuestionsLocked(questions, map)) {
      handleCompleteQuiz();
      return;
    }

    // Check if active batch has unlocked questions remaining
    const nextUnlockedInBatch = batchQuestions.filter((q) => !map.get(q.id)?.locked);

    if (nextUnlockedInBatch.length === 0) {
      // Advance to next batch
      const nextBatchNum = MasteryEngineService.getActiveBatchNumber(questions, map);
      if (nextBatchNum === -1) {
        handleCompleteQuiz();
      } else {
        setRestingCompletedBatch(currentBatch);
        setRestingNextBatch(nextBatchNum);
        setShowRestTimer(true);
      }
    } else {
      if (wasLocked) {
        setCycleIndex((prev) => prev % nextUnlockedInBatch.length);
      } else {
        setCycleIndex((prev) => (prev + 1) % nextUnlockedInBatch.length);
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
            <span className="font-bold text-emerald-500">100% Locked</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Next Review:</span>
            <span className="font-bold text-primary">In 24 Hours</span>
          </div>
        </div>

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
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            Batch #{currentBatch + 1}
          </span>
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

          {isEvaluating && activeQuestion.explanation && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground animate-fade-in">
              💡 <span className="font-semibold text-foreground">Explanation:</span> {activeQuestion.explanation}
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
            setCycleIndex(0);
          }}
        />
      )}
    </div>
  );
}

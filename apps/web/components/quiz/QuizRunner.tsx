'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Layers,
  PenTool,
  RotateCcw,
  Settings,
  Shuffle,
  Volume2,
  VolumeX
} from 'lucide-react';
import type { Quiz, QuizMode, QuizQuestion, QuizSession, QuestionProgress } from '@quiz-creator/types';
import type { PersonalizedFeedbackConfig } from '@/lib/personalized-feedback';
import { useQuizSession } from '@/hooks/useQuizSession';
import QuizCompletion from '@/components/quiz/QuizCompletion';
import QuizRecap from '@/components/quiz/QuizRecap';
import { QuestionRenderer } from '@/components/quiz/QuizQuestionRenderer';
import WindFlameBadge from '@/components/quiz/WindFlameBadge';
import QuizContinueDock from '@/components/quiz/QuizContinueDock';
import ResumePracticeModal from '@/components/quiz/ResumePracticeModal';
import { removeQuizProgressSnapshot } from '@/lib/quizProgressPersistence';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface QuizRunnerProps {
  quiz: Quiz;
  initialQuestions: QuizQuestion[];
  initialSession: QuizSession;
  initialProgress: QuestionProgress[];
  mode: QuizMode;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  personalizedFeedback?: PersonalizedFeedbackConfig | null;
}

export default function QuizRunner(props: QuizRunnerProps) {
  const { quiz, mode } = props;
  const [currentMode, setCurrentMode] = useState<QuizMode>(mode);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [shuffleToast, setShuffleToast] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const resumePromptShownRef = useRef(false);

  const session = useQuizSession({ ...props, mode: currentMode });
  const {
    questions,
    progressMap,
    accumulatedStruggleIds,
    isStruggleReviewMode,
    activeQuestion,
    currentProg,
    isRetryQuestion,
    currentOptions,
    isCardFlipped,
    selectedOptionId,
    isEvaluating,
    pendingAdvance,
    isRecapVisible,
    isQuestionTransitioning,
    identificationInput,
    identificationSubmitted,
    typedAnswerCorrect,
    answerResult,
    correctAnswerIds,
    currentStreak,
    bestStreak,
    feedbackMessage,
    isHintVisible,
    isExplanationVisible,
    hasRestoredProgress,
    isProgressHydrated,
    isCompleted,
    isMuted,
    cardTelemetry,
    sessionSummary,
    setIsCardFlipped,
    setIdentificationInput,
    setIsHintVisible,
    answerQuestion,
    submitTypedAnswer,
    advance,
    resetProgress,
    startStruggleReview,
    complete,
    shuffleRemainingQueue,
    handleSurfaceClick,
    handleSurfaceKeyDown,
    toggleMute,
    giveUp
  } = session;

  const handleConfirmReset = () => {
    resetProgress();
    setShowSettingsModal(false);
  };

  const isMultipleChoiceMode = currentMode === 'multiple_choice';
  const isDesktopViewportMode = isMultipleChoiceMode || currentMode === 'identification';
  const isResumePromptMode = mode === 'multiple_choice' || mode === 'identification';
  const hasExistingMasteryProgress = props.initialProgress.some((progress) => progress.locked);

  useEffect(() => {
    if (
      !isProgressHydrated ||
      isCompleted ||
      !isResumePromptMode ||
      resumePromptShownRef.current ||
      (!hasRestoredProgress && !hasExistingMasteryProgress)
    ) return;

    resumePromptShownRef.current = true;
    setShowResumePrompt(true);
  }, [hasExistingMasteryProgress, hasRestoredProgress, isCompleted, isProgressHydrated, isResumePromptMode]);

  if (!isProgressHydrated) {
    return <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center text-center text-xs text-muted-foreground">Restoring your quiz progress...</div>;
  }

  if (isCompleted) {
    const summary = sessionSummary;
    if (!summary) return null;
    return (
      <QuizCompletion
        quiz={quiz}
        questions={questions}
        summary={summary}
        cardTelemetry={cardTelemetry}
        accumulatedStruggleIds={accumulatedStruggleIds}
        onStartStruggleReview={() => startStruggleReview()}
      />
    );
  }

  const activeProgressMap = pendingAdvance?.progressMap || progressMap;
  const totalLockedCount = questions.filter((question) => activeProgressMap.get(question.id)?.locked).length;
  const correctAnswerCount = correctAnswerIds.size;
  const overallPercent = Math.round((totalLockedCount / (questions.length || 1)) * 100);
  const questionsPerReviewRound = 7;
  const reviewRoundCount = Math.max(1, Math.ceil(questions.length / questionsPerReviewRound));
  const progressSegments = Array.from({ length: reviewRoundCount }, (_, index) => {
    const segmentStart = index * questionsPerReviewRound;
    const segmentSize = Math.min(questionsPerReviewRound, questions.length - segmentStart);
    const completedInSegment = Math.min(Math.max(totalLockedCount - segmentStart, 0), segmentSize);
    return { id: index, fillPercent: segmentSize > 0 ? (completedInSegment / segmentSize) * 100 : 0 };
  });
  const progressPercent = progressSegments.reduce((sum, segment) => sum + segment.fillPercent, 0) / reviewRoundCount;
  const questionsUntilNextCheckIn = Math.min(
    questionsPerReviewRound,
    Math.max(questions.length - totalLockedCount, 0)
  );
  const resetSavedReview = () => {
    removeQuizProgressSnapshot(quiz.id, props.initialSession.id);
    window.location.assign(`/practice/${quiz.id}?mode=learn`);
  };
  const resumePrompt = (
    <ResumePracticeModal
      open={showResumePrompt}
      progressPercent={overallPercent}
      completedQuestions={totalLockedCount}
      questionsUntilNextCheckIn={questionsUntilNextCheckIn}
      onContinue={() => setShowResumePrompt(false)}
      onReset={resetSavedReview}
    />
  );

  if (isRecapVisible && pendingAdvance) {
    return (
      <>
        <QuizRecap
          questions={questions}
          recapQuestionIds={pendingAdvance.recapQuestionIds}
          totalLockedCount={totalLockedCount}
          correctAnswerCount={correctAnswerCount}
          overallPercent={overallPercent}
          progressSegments={progressSegments}
          progressPercent={progressPercent}
          mode={currentMode}
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          onSurfaceClick={handleSurfaceClick}
          onSurfaceKeyDown={handleSurfaceKeyDown}
        />
        <QuizContinueDock onAdvance={advance} />
        {resumePrompt}
      </>
    );
  }

  if (!activeQuestion) {
    return <div className="max-w-md mx-auto py-12 text-center text-xs text-muted-foreground">Loading mastery session...</div>;
  }

  return (
    <div
      className={`mx-auto max-w-5xl ${isMultipleChoiceMode ? `mobile-multiple-choice-viewport ${pendingAdvance ? 'pb-20' : 'pb-4'}` : 'space-y-6 pb-28 sm:pb-32'} ${isDesktopViewportMode ? `desktop-quiz-viewport lg:flex lg:flex-col lg:gap-3 lg:space-y-0 ${pendingAdvance ? 'lg:pb-20' : 'lg:pb-8'}` : ''}`}
      onClick={handleSurfaceClick}
      onKeyDown={handleSurfaceKeyDown}
    >
      <div className="flex items-center justify-between">
        <Link href={`/review/${quiz.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Return to Reviewer</Link>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <WindFlameBadge
            streak={currentStreak}
            totalQuestions={questions.length}
            bestStreak={bestStreak}
            size="md"
          />

          {/* Settings Button */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowSettingsModal(true);
            }}
            className="p-1.5 rounded-full border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-2xs active:scale-95"
            title="Session Settings & Study Mode"
            aria-label="Session Settings & Study Mode"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button type="button" onClick={toggleMute} className="p-1.5 rounded-full border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95" title={isMuted ? 'Unmute Sound' : 'Mute Sound'} aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}>{isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
          {/* {isStruggleReviewMode && <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-500">Struggle Pile Review</span>}
          {accumulatedStruggleIds.length > 0 && <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /><span>{accumulatedStruggleIds.length} in Struggle Pile</span></span>} */}
        </div>
      </div>

      <div className="space-y-2" aria-label={`Quiz progress: ${totalLockedCount} of ${questions.length} questions mastered (${correctAnswerCount} answers correct)`}>
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground"><span>Progress</span></div>
        {currentMode === 'multiple_choice' || currentMode === 'reverse' || currentMode === 'identification' ? (
          <div className="flex w-full min-w-0 items-center gap-2 pt-1 pr-2">
            <div className="relative min-w-0 flex-1">
              <div className="flex h-2 w-full gap-1" aria-hidden="true">{progressSegments.map((segment) => <div key={segment.id} className="min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${segment.fillPercent}%` }} /></div>)}</div>
              {totalLockedCount > 0 && totalLockedCount < questions.length && (
                <div
                  className="absolute left-0 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white shadow-sm ring-2 ring-background transition-[left] duration-300"
                  style={{ left: `${progressPercent}%` }}
                  aria-hidden="true"
                >
                  {totalLockedCount}
                </div>
              )}
            </div>
            <div
              className="mr-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted-foreground text-sm font-black text-background shadow-sm ring-2 ring-background"
              aria-hidden="true"
            >
              {questions.length}
            </div>
          </div>
        ) : <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${overallPercent}%` }} /></div>}
      </div>

      <div className={isMultipleChoiceMode ? 'quiz-question-stage min-h-0 overflow-visible' : isDesktopViewportMode ? 'overflow-visible lg:min-h-0 lg:flex-none' : 'overflow-hidden'}>
        <div
          key={activeQuestion.id}
          className={`${isQuestionTransitioning ? 'quiz-question-card-exit' : 'quiz-question-card-enter'} ${isDesktopViewportMode ? 'lg:h-auto lg:min-h-0' : ''} ${isMultipleChoiceMode ? 'min-h-0' : ''}`}
        >
          <QuestionRenderer
            mode={currentMode}
            desktopViewport={isDesktopViewportMode}
            question={activeQuestion}
            currentProg={currentProg}
            currentStreak={currentStreak}
            totalQuestions={questions.length}
            isEvaluating={isEvaluating}
            identificationInput={identificationInput}
            identificationSubmitted={identificationSubmitted}
            typedAnswerCorrect={typedAnswerCorrect}
            selectedOptionId={selectedOptionId}
            answerResult={answerResult}
            feedbackMessage={feedbackMessage}
            isHintVisible={isHintVisible}
            isExplanationVisible={isExplanationVisible}
            currentOptions={currentOptions}
            isCardFlipped={isCardFlipped}
            isRetryQuestion={isRetryQuestion}
            onAnswer={(option) => answerQuestion(option)}
            onSubmitTyped={submitTypedAnswer}
            onInputChange={setIdentificationInput}
            onFlip={() => setIsCardFlipped((flipped) => !flipped)}
            onShowHint={() => setIsHintVisible(true)}
            onAdvance={advance}
            onDontKnow={() => giveUp(currentMode === 'learn' || currentMode === 'identification' ? currentMode : undefined)}
          />
        </div>
      </div>

      {pendingAdvance && !isRecapVisible && (
        <QuizContinueDock
          onAdvance={advance}
          message={
            pendingAdvance.recapQuestionIds.length > 0
              ? 'Tap anywhere to open your seven-card recap'
              : 'Press anywhere to continue'
          }
        />
      )}

      {resumePrompt}

      {/* Session Settings & Mode Switcher Modal */}
      <Modal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        title="Session Settings"
        description="Switch study mode or shuffle questions without losing your progress."
      >
        <div className="space-y-5 pt-1">
          {/* Progress Preservation Guarantee Card */}
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                Progress:
              </span>
            </div>
            <span className="font-bold text-foreground">
              {totalLockedCount}/{questions.length} Mastered (Streak: {currentStreak})
            </span>
          </div>

          {/* Mode Switcher */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Study Mode
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { id: 'multiple_choice' as QuizMode, name: 'Multiple Choice', desc: 'Select correct option', icon: Layers },
                { id: 'identification' as QuizMode, name: 'Identification', desc: 'Type exact answer', icon: PenTool },
                { id: 'flashcard' as QuizMode, name: 'Flashcard', desc: '3D Flip card recall', icon: BookOpen },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = currentMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setCurrentMode(m.id);
                    }}
                    className={`flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                        : 'border-border bg-card hover:bg-muted/50 text-foreground'
                      }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {isSelected && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          Active
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shuffle Mode */}
          <div className="space-y-2 pt-1 border-t border-border/40">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Question Order
            </label>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Shuffle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Shuffle Questions</p>
                  <p className="text-[10px] text-muted-foreground">Randomize order of upcoming questions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  shuffleRemainingQueue();
                  setShuffleToast(true);
                  setTimeout(() => setShuffleToast(false), 2000);
                }}
                className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all active:scale-95"
              >
                {shuffleToast ? 'Shuffled! ✨' : 'Shuffle Now'}
              </button>
            </div>
          </div>

          {/* Reset Progress */}
          <div className="space-y-2 pt-1 border-t border-border/40">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Reset Progress
            </label>
            <div className="flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Reset Progress</p>
                  <p className="text-[10px] text-muted-foreground">Start over from question 1 with 0% mastery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-white transition-all active:scale-95"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Close Action */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(false)}
            className="w-full rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            Apply & Continue
          </button>
        </div>
      </Modal>

      {/* Reset Progress Confirmation Modal */}
      <ConfirmModal
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        onConfirm={handleConfirmReset}
        title="Reset Progress"
        message="Are you sure you want to reset your progress?"
        confirmText="Reset Progress"
        destructive
      />
    </div>
  );
}

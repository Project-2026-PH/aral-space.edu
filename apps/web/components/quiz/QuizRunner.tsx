'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Volume2,
  VolumeX
} from 'lucide-react';
import type { Quiz, QuizMode, QuizQuestion, QuizSession, QuestionProgress } from '@quiz-creator/types';
import { useQuizSession } from '@/hooks/useQuizSession';
import QuizCompletion from '@/components/quiz/QuizCompletion';
import QuizRecap from '@/components/quiz/QuizRecap';
import { QuestionRenderer } from '@/components/quiz/QuizQuestionRenderer';

interface QuizRunnerProps {
  quiz: Quiz;
  initialQuestions: QuizQuestion[];
  initialSession: QuizSession;
  initialProgress: QuestionProgress[];
  mode: QuizMode;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

export default function QuizRunner(props: QuizRunnerProps) {
  const { quiz, mode } = props;
  const session = useQuizSession(props);
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
    feedbackMessage,
    isHintVisible,
    isExplanationVisible,
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
    startStruggleReview,
    handleSurfaceClick,
    handleSurfaceKeyDown,
    toggleMute
  } = session;

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

  if (isRecapVisible && pendingAdvance) {
    return (
      <QuizRecap
        questions={questions}
        recapQuestionIds={pendingAdvance.recapQuestionIds}
        correctAnswerCount={correctAnswerIds.size}
        onAdvance={advance}
        onSurfaceClick={handleSurfaceClick}
        onSurfaceKeyDown={handleSurfaceKeyDown}
      />
    );
  }

  if (!activeQuestion) {
    return <div className="max-w-md mx-auto py-12 text-center text-xs text-muted-foreground">Loading mastery session...</div>;
  }

  const totalLockedCount = questions.filter((question) => progressMap.get(question.id)?.locked).length;
  const correctAnswerCount = correctAnswerIds.size;
  const overallPercent = Math.round((totalLockedCount / questions.length) * 100);
  const questionsPerReviewRound = 7;
  const reviewRoundCount = Math.max(1, Math.ceil(questions.length / questionsPerReviewRound));
  const progressSegments = Array.from({ length: reviewRoundCount }, (_, index) => {
    const segmentStart = index * questionsPerReviewRound;
    const segmentSize = Math.min(questionsPerReviewRound, questions.length - segmentStart);
    const completedInSegment = Math.min(Math.max(totalLockedCount - segmentStart, 0), segmentSize);
    return { id: index, fillPercent: segmentSize > 0 ? (completedInSegment / segmentSize) * 100 : 0 };
  });
  const completedRoundCount = Math.min(Math.floor(totalLockedCount / questionsPerReviewRound), reviewRoundCount);
  const completedRoundPercent = (completedRoundCount / reviewRoundCount) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20" onClick={handleSurfaceClick} onKeyDown={handleSurfaceKeyDown}>
      <div className="flex items-center justify-between">
        <Link href={`/review/${quiz.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Return to Reviewer</Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleMute} className="p-1.5 rounded-full border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={isMuted ? 'Unmute Sound' : 'Mute Sound'} aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}>{isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
          {isStruggleReviewMode && <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-500">Struggle Pile Review</span>}
          {accumulatedStruggleIds.length > 0 && <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /><span>{accumulatedStruggleIds.length} in Struggle Pile</span></span>}
        </div>
      </div>

      <div className="space-y-2" aria-label={`Quiz progress: ${correctAnswerCount} of ${questions.length} answers correct`}>
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground"><span>Progress</span><span className="text-emerald-600 dark:text-emerald-400">Correct: {correctAnswerCount} / {questions.length}</span></div>
        {mode === 'multiple_choice' || mode === 'reverse' ? (
          <div className="relative pt-1">
            <div className="flex h-2 w-full gap-1" aria-hidden="true">{progressSegments.map((segment) => <div key={segment.id} className="min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${segment.fillPercent}%` }} /></div>)}</div>
            {totalLockedCount > 0 && totalLockedCount < questions.length && <div className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white shadow-sm ring-2 ring-background" style={{ left: `${completedRoundPercent}%` }} aria-hidden="true">{completedRoundCount * questionsPerReviewRound}</div>}
            <div className="absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-muted-foreground text-sm font-black text-background shadow-sm ring-2 ring-background" aria-hidden="true">{questions.length}</div>
          </div>
        ) : <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${overallPercent}%` }} /></div>}
      </div>

      <div className="overflow-hidden">
        <div key={activeQuestion.id} className={isQuestionTransitioning ? 'quiz-question-card-exit' : 'quiz-question-card-enter'}>
          <QuestionRenderer
            mode={mode}
            question={activeQuestion}
            currentProg={currentProg}
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
          />
        </div>
      </div>

      {pendingAdvance && !isRecapVisible && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary animate-fade-in"><span>{pendingAdvance.recapQuestionIds.length > 0 ? 'Tap anywhere to open your seven-card recap' : 'Press any key to continue'}</span><button type="button" onClick={advance} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary/90"><span>Continue</span><span aria-hidden="true">›</span></button></div>}
    </div>
  );
}

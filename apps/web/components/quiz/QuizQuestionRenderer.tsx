'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Lightbulb,
  Sparkles,
  Tag,
  Volume2,
  XCircle
} from 'lucide-react';
import type {
  QuizMode,
  QuizQuestion,
  QuestionProgress,
  ShuffledOption
} from '@quiz-creator/types';
import { getQuestionAnswer, getQuestionHint } from '@/lib/quizAnswerEvaluation';
import WindFlameBadge from '@/components/quiz/WindFlameBadge';
import RichTextContent from '@/components/editor/RichTextContent';

function parseOptionText(text: string): { label?: string; title: string } {
  const stageMatch = text.match(/^(Stage\s*\d+[:.-]?)\s*(.*)$/i);
  if (stageMatch && stageMatch[2].trim()) {
    return { label: stageMatch[1].trim(), title: stageMatch[2].trim() };
  }

  const numberedMatch = text.match(/^((?:Step|Phase|Level|Part)\s*\d+[:.-]?|\d+[:.])\s*(.*)$/i);
  if (numberedMatch && numberedMatch[2].trim()) {
    return { label: numberedMatch[1].trim(), title: numberedMatch[2].trim() };
  }

  return { title: text };
}

interface SharedQuestionProps {
  question: QuizQuestion;
  currentProg: QuestionProgress | null;
  currentStreak?: number;
  totalQuestions?: number;
  isEvaluating: boolean;
  identificationInput: string;
  identificationSubmitted: boolean;
  typedAnswerCorrect: boolean | null;
  selectedOptionId: number | null;
  answerResult: boolean | null;
  feedbackMessage: string | null;
  isHintVisible: boolean;
  isExplanationVisible: boolean;
  currentOptions: ShuffledOption[];
  isCardFlipped: boolean;
  isRetryQuestion: boolean;
  onAnswer: (option: ShuffledOption) => void;
  onSubmitTyped: (mode: 'learn' | 'identification') => void;
  onInputChange: (value: string) => void;
  onFlip: () => void;
  onShowHint: () => void;
  onAdvance?: () => void;
  onDontKnow?: () => void;
  desktopViewport?: boolean;
}

export interface QuizQuestionRendererProps extends SharedQuestionProps {
  mode: QuizMode;
}

export function LearnQuestion(props: SharedQuestionProps & { mode: QuizMode }): React.ReactElement {
  const {
    mode,
    question,
    currentProg,
    currentStreak,
    totalQuestions,
    isEvaluating,
    identificationInput,
    identificationSubmitted,
    typedAnswerCorrect,
    isHintVisible,
    onInputChange,
    onSubmitTyped,
    onShowHint,
    onAdvance,
    onDontKnow,
    desktopViewport
  } = props;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDontKnow = () => {
    if (isEvaluating || identificationSubmitted) return;
    if (onDontKnow) {
      onDontKnow();
      return;
    }
    onInputChange("Don't know");
    onSubmitTyped('learn');
  };

  return (
    <div className={`w-full min-h-[480px] rounded-3xl border border-border/80 bg-card p-6 sm:p-9 shadow-md flex flex-col justify-between space-y-4 ${desktopViewport ? 'desktop-quiz-card lg:h-auto lg:min-h-0 lg:overflow-visible lg:p-5 lg:space-y-3' : ''}`}>
      {/* Top Section: Header */}
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{mode === 'learn' ? 'Learn Mode · Type the answer' : 'Not enough choices · Type the answer'}</span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onShowHint}
            disabled={isHintVisible || isEvaluating || identificationSubmitted}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lightbulb className={`h-3.5 w-3.5 ${isHintVisible ? 'text-amber-500 fill-amber-500/20' : 'text-primary'}`} />
            <span>{isHintVisible ? 'Hint active' : 'Hint'}</span>
          </button>
        </div>
      </div>

      {/* Centered Question & Input Body */}
      <div className={`flex-1 flex flex-col justify-center items-center text-center space-y-6 my-auto py-2 ${desktopViewport ? 'lg:space-y-3' : ''}`}>
        <div className="space-y-3 max-w-xl mx-auto">
          <RichTextContent html={question.question_text} className="text-base sm:text-lg font-bold text-foreground leading-relaxed text-center" />
          {isHintVisible && (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in duration-200">
              <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>Hint: {getQuestionHint(question)}</span>
            </div>
          )}
        </div>

        {/* Input & Action Button */}
        <form
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            if (identificationSubmitted) {
              onAdvance?.();
            } else if (!isEvaluating && identificationInput.trim()) {
              inputRef.current?.blur();
              onSubmitTyped('learn');
            }
          }}
          className={`w-full max-w-md mx-auto space-y-3 ${desktopViewport ? 'lg:space-y-2' : ''}`}
        >
          <input
            ref={inputRef}
            type="text"
            name="quiz_study_response"
            id="quiz_study_response"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            aria-autocomplete="none"
            placeholder="Type your answer..."
            value={identificationInput}
            onChange={(event) => onInputChange(event.target.value)}
            disabled={isEvaluating || identificationSubmitted}
            className={`w-full rounded-2xl border bg-background px-4 py-3 text-sm font-medium text-foreground text-center focus:outline-none transition-colors ${typedAnswerCorrect === true
              ? 'border-emerald-500 ring-1 ring-emerald-500'
              : typedAnswerCorrect === false
                ? 'border-destructive ring-1 ring-destructive'
                : 'border-border focus:border-primary'
              }`}
          />
          {identificationSubmitted ? (
            <button
              type="button"
              onClick={() => onAdvance?.()}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95 animate-in fade-in duration-200"
            >
              <span>Continue</span>
              <span aria-hidden="true">›</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isEvaluating || !identificationInput.trim()}
              className="w-full rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check Answer
            </button>
          )}
        </form>
      </div>

      {/* Bottom Section: Feedback */}
      <div className="min-h-[72px] flex flex-col justify-end">
        {identificationSubmitted ? (
          <div className={`rounded-2xl border p-4 text-xs space-y-2 text-center animate-in fade-in duration-200 lg:p-3 ${typedAnswerCorrect
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-destructive/30 bg-destructive/10'
            }`}>
            <div className="flex items-center justify-center gap-2 font-bold">
              {typedAnswerCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
              <span>{typedAnswerCorrect ? 'Correct answer' : 'Keep practicing'}</span>
            </div>
            <p className="text-foreground">Correct answer: <span className="font-bold">{getQuestionAnswer(question)}</span></p>
            {!typedAnswerCorrect && <p className="text-muted-foreground">Your answer: {identificationInput}</p>}
            {question.explanation && <RichTextContent html={question.explanation} className="text-muted-foreground italic" />}
          </div>
        ) : (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleDontKnow}
              disabled={isEvaluating || identificationSubmitted}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Don&apos;t know</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FlashcardQuestion(props: SharedQuestionProps): React.ReactElement {
  const {
    question,
    isCardFlipped,
    isHintVisible,
    isEvaluating,
    onFlip,
    onAnswer,
    onShowHint,
    onDontKnow
  } = props;

  const handleDontKnow = () => {
    if (isEvaluating) return;
    if (onDontKnow) {
      onDontKnow();
      return;
    }
    onAnswer({
      optionId: -1,
      text: "Don't know",
      isCorrect: false
    });
  };

  return (
    <div onClick={onFlip} className="perspective-1000 cursor-pointer min-h-[480px]">
      <div
        key={question.id}
        className={`relative w-full min-h-[480px] rounded-3xl border border-border/80 bg-card p-6 sm:p-9 shadow-md transition-transform duration-500 transform-style-3d flex flex-col justify-between ${isCardFlipped ? 'rotate-y-180' : ''}`}
      >
        <div className={`space-y-4 backface-hidden ${isCardFlipped ? 'hidden' : 'block'}`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>Prompt (Click to Flip)</span>
            <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={onShowHint}
                disabled={isHintVisible}
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Lightbulb className={`h-3.5 w-3.5 ${isHintVisible ? 'text-amber-500 fill-amber-500/20' : 'text-primary'}`} />
                <span>{isHintVisible ? 'Hint active' : 'Get a hint'}</span>
              </button>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
          </div>
          <RichTextContent html={question.question_text} className="text-base font-bold text-foreground leading-relaxed" />
          {isHintVisible && (
            <div
              className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in duration-200"
              onClick={(event) => event.stopPropagation()}
            >
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>Hint: {getQuestionHint(question)}</span>
            </div>
          )}
          <div className="flex justify-end pt-4" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={handleDontKnow}
              disabled={isEvaluating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Don&apos;t know</span>
            </button>
          </div>
        </div>

        <div className={`space-y-4 backface-hidden rotate-y-180 ${!isCardFlipped ? 'hidden' : 'block'}`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>Answer & Explanation</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-base font-bold text-primary">{getQuestionAnswer(question)}</p>
          {question.explanation && <RichTextContent html={question.explanation} className="text-xs text-muted-foreground italic leading-relaxed" />}
          <div className="pt-4 flex gap-3" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => onAnswer({ optionId: question.correct_answer, text: getQuestionAnswer(question), isCorrect: true })}
              className="flex-1 rounded-2xl bg-emerald-500 py-3 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
            >
              I Got It Right
            </button>
            <button
              type="button"
              onClick={() => onAnswer({ optionId: (question.correct_answer + 1) % 4, text: 'incorrect', isCorrect: false })}
              className="flex-1 rounded-2xl bg-muted py-3 text-xs font-bold text-foreground hover:bg-muted/80 transition-all active:scale-95"
            >
              Need Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IdentificationQuestion(props: SharedQuestionProps): React.ReactElement {
  const {
    question,
    identificationInput,
    identificationSubmitted,
    isEvaluating,
    isHintVisible,
    onInputChange,
    onSubmitTyped,
    onShowHint,
    onAdvance,
    onDontKnow,
    desktopViewport
  } = props;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDontKnow = () => {
    if (isEvaluating || identificationSubmitted) return;
    if (onDontKnow) {
      onDontKnow();
      return;
    }
    onInputChange("Don't know");
    onSubmitTyped('identification');
  };

  return (
    <div className={`w-full min-h-[480px] rounded-3xl border border-border/80 bg-card p-6 sm:p-9 shadow-md flex flex-col justify-between space-y-4 ${desktopViewport ? 'desktop-quiz-card lg:h-auto lg:min-h-0 lg:overflow-visible lg:p-5 lg:space-y-3' : ''}`}>
      {/* Top Section */}
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Question Prompt</span>
        <button
          type="button"
          onClick={onShowHint}
          disabled={isHintVisible || isEvaluating || identificationSubmitted}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Lightbulb className={`h-3.5 w-3.5 ${isHintVisible ? 'text-amber-500 fill-amber-500/20' : 'text-primary'}`} />
          <span>{isHintVisible ? 'Hint active' : 'Need a hint?'}</span>
        </button>
      </div>

      {/* Centered Question & Input Body */}
      <div className={`flex-1 flex flex-col justify-center items-center text-center space-y-6 my-auto py-2 ${desktopViewport ? 'lg:space-y-3' : ''}`}>
        <div className="space-y-3 max-w-xl mx-auto">
          <RichTextContent html={question.question_text} className="text-base sm:text-lg font-bold text-foreground leading-relaxed text-center" />
          {isHintVisible && (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in duration-200">
              <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>Hint: {getQuestionHint(question)}</span>
            </div>
          )}
        </div>

        {/* Input & Action Button */}
        <form
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            if (identificationSubmitted) {
              onAdvance?.();
            } else if (!isEvaluating && identificationInput.trim()) {
              inputRef.current?.blur();
              onSubmitTyped('identification');
            }
          }}
          className={`w-full max-w-md mx-auto space-y-3 ${desktopViewport ? 'lg:space-y-2' : ''}`}
        >
          <input
            ref={inputRef}
            type="text"
            name="quiz_identification_response"
            id="quiz_identification_response"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            aria-autocomplete="none"
            placeholder="Type exact answer..."
            value={identificationInput}
            onChange={(event) => onInputChange(event.target.value)}
            disabled={isEvaluating || identificationSubmitted}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground text-center focus:border-primary focus:outline-none"
          />
          {identificationSubmitted ? (
            <button
              type="button"
              onClick={() => onAdvance?.()}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95 animate-in fade-in duration-200"
            >
              <span>Continue</span>
              <span aria-hidden="true">›</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isEvaluating || !identificationInput.trim()}
              className="w-full rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check Answer
            </button>
          )}
        </form>
      </div>

      {/* Result Section */}
      <div className="min-h-[72px] flex flex-col justify-end">
        {identificationSubmitted ? (
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 text-xs space-y-1 text-center animate-in fade-in duration-200">
            <p className="font-bold text-foreground">Correct Answer: {getQuestionAnswer(question)}</p>
            {question.explanation && <RichTextContent html={question.explanation} className="text-muted-foreground text-[11px] leading-relaxed" />}
          </div>
        ) : (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleDontKnow}
              disabled={isEvaluating || identificationSubmitted}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Don&apos;t know</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MultipleChoiceQuestion(props: SharedQuestionProps): React.ReactElement {
  const {
    question,
    currentProg,
    currentStreak,
    totalQuestions,
    isEvaluating,
    selectedOptionId,
    answerResult,
    feedbackMessage,
    isHintVisible,
    isExplanationVisible,
    currentOptions,
    isRetryQuestion,
    onAnswer,
    onShowHint,
    onDontKnow,
    desktopViewport
  } = props;
  const definitionContentRef = React.useRef<HTMLDivElement>(null);

  const handleDontKnow = () => {
    if (isEvaluating) return;
    if (onDontKnow) {
      onDontKnow();
      return;
    }
    onAnswer({
      optionId: -1,
      text: "Don't know",
      isCorrect: false
    });
  };
  const [isDefinitionScrollable, setIsDefinitionScrollable] = React.useState(false);
  const hasExplanationContent = Boolean(
    question.correct_explanation ||
    question.explanation ||
    (selectedOptionId !== null &&
      selectedOptionId !== question.correct_answer &&
      question.distractor_explanations?.[selectedOptionId]) ||
    question.discriminatory_keywords?.length
  );

  React.useEffect(() => {
    const content = definitionContentRef.current;
    if (!content) return;

    const updateScrollState = () => {
      // Five lines at the component's 1.5rem line-height threshold.
      setIsDefinitionScrollable(content.scrollHeight > 5 * 1.5 * 16);
    };

    updateScrollState();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(content);
    return () => observer.disconnect();
  }, [question.question_text]);

  return (
    <div className={`multiple-choice-study-card w-full min-w-0 h-auto max-h-[80vh] rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-md flex flex-col gap-2 sm:gap-3 overflow-x-hidden overflow-y-auto ${desktopViewport ? 'desktop-quiz-card lg:max-h-[80vh] lg:p-5 lg:gap-3' : ''}`}>
      {/* Top Section: Prompt & Status */}
      <div className="flex-none shrink-0 space-y-2 pr-1">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Definition</span>
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onShowHint}
              disabled={isHintVisible || isEvaluating || answerResult !== null}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lightbulb className={`h-3.5 w-3.5 ${isHintVisible ? 'text-amber-500 fill-amber-500/20' : 'text-primary'}`} />
              <span>{isHintVisible ? 'Hint active' : 'Hint'}</span>
            </button>
          </div>
        </div>

        <div
          ref={definitionContentRef}
          className={isDefinitionScrollable ? 'max-h-[calc(5*1.5rem)] overflow-y-auto pr-1' : undefined}
        >
          <RichTextContent html={question.question_text} className="text-sm sm:text-base font-bold text-foreground leading-relaxed" />
        </div>

        {/* Stable hint banner under prompt */}
        {isHintVisible && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in duration-200">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>Hint: {getQuestionHint(question)}</span>
          </div>
        )}
      </div>

      {/* Feedback */}
      {isEvaluating && answerResult !== null && (
        <div className="shrink-0 space-y-2 pr-1">
          <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs sm:text-sm font-bold animate-in fade-in duration-200 ${answerResult
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
            {answerResult ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            )}
            <span>{feedbackMessage || (answerResult ? 'Correct Answer!' : "No problem. You're still learning!")}</span>
          </div>
        </div>
      )}

      {/* Middle Section: Options */}
      <div className="min-h-0 flex flex-none flex-col space-y-2 lg:flex-1">
        <div className="flex items-center justify-between text-xs font-bold text-foreground">
          <span>Choose an answer</span>
          {isRetryQuestion && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
              Let&apos;s try again
            </span>
          )}
        </div>

        <div className="min-h-0 flex-none overflow-visible pr-1 lg:flex-1 lg:overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
          {currentOptions.map((option, index) => {
            const isSelected = selectedOptionId === option.optionId;
            let style = 'border-border bg-background/50 hover:border-primary/50 hover:bg-card';
            if (isEvaluating) {
              if (option.isCorrect) {
                const userSelectedWrong = selectedOptionId !== null && selectedOptionId !== option.optionId;
                style = userSelectedWrong
                  ? 'border-2 border-dashed border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 font-semibold'
                  : 'border-2 border-solid border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 font-semibold';
              } else if (isSelected && !option.isCorrect) {
                style = 'border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive font-semibold';
              } else {
                style = 'border-border/60 bg-muted/30 opacity-50';
              }
            }

            return (
              <button
                type="button"
                key={option.optionId}
                onClick={() => onAnswer(option)}
                disabled={isEvaluating}
                aria-keyshortcuts={String(index + 1)}
                className={`flex min-h-[3.5rem] items-start gap-3 rounded-2xl border p-3 sm:p-3.5 text-left transition-all active:scale-[0.98] lg:p-2.5 ${style}`}
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold shrink-0 transition-colors ${isEvaluating && option.isCorrect
                  ? 'bg-emerald-500 text-white'
                  : isEvaluating && isSelected && !option.isCorrect
                    ? 'bg-destructive text-white'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                  {index + 1}
                </span>
                <span className="text-xs font-semibold text-foreground pt-0.5 leading-snug">
                  {option.text}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {/* Explanation */}
      {isEvaluating && isExplanationVisible && hasExplanationContent && (
        <div className="shrink-0 space-y-2 pr-1">
          <div className="space-y-2 pt-1 animate-in fade-in duration-200">
            {(question.correct_explanation || question.explanation) && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground space-y-1 lg:p-3">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Principle & Explanation:</span>
                </div>
                <RichTextContent html={question.correct_explanation || question.explanation} className="text-foreground leading-relaxed" />
              </div>
            )}
            {selectedOptionId !== null && selectedOptionId !== question.correct_answer && question.distractor_explanations?.[selectedOptionId] && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-muted-foreground space-y-1 lg:p-3">
                <div className="flex items-center gap-1.5 font-bold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Why Choice {currentOptions.findIndex((option) => option.optionId === selectedOptionId) + 1} is Incorrect:</span>
                </div>
                <p className="text-foreground leading-relaxed">{question.distractor_explanations[selectedOptionId]}</p>
              </div>
            )}
            {question.discriminatory_keywords && question.discriminatory_keywords.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Key Discriminators:
                </span>
                {question.discriminatory_keywords.map((keyword, index) => (
                  <span key={index} className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lower Right Action: Don't know button */}
      {!isEvaluating && (
        <div className="flex justify-end pt-1 shrink-0">
          <button
            type="button"
            onClick={handleDontKnow}
            disabled={isEvaluating}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <Flag className="h-3.5 w-3.5" />
            <span>Don&apos;t know</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function QuestionRenderer({ mode, ...props }: QuizQuestionRendererProps): React.ReactElement {
  if (mode === 'learn' || ((mode === 'multiple_choice' || mode === 'reverse') && props.question.options.length < 2)) {
    return <LearnQuestion mode={mode} {...props} />;
  }
  if (mode === 'flashcard') return <FlashcardQuestion {...props} />;
  if (mode === 'identification') return <IdentificationQuestion {...props} />;
  return <MultipleChoiceQuestion {...props} />;
}

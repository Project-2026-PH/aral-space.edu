'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CognitiveMasteryQueue,
  MasteryEngineService,
  QuizShuffleService,
  QuizTransformService
} from '@quiz-creator/core';
import type {
  CardTelemetryRecord,
  PracticeSessionState,
  QuestionProgress,
  Quiz,
  QuizMode,
  QuizQuestion,
  QuizSession,
  SessionMasterySummary,
  ShuffledOption
} from '@quiz-creator/types';
import { quizAudio } from '@/lib/audio';
import { triggerCelebrationConfetti } from '@/lib/confetti';
import {
  createAnswerEventId,
  readQuizProgressSnapshot,
  removeQuizProgressSnapshot,
  writeQuizProgressSnapshot,
  type PersistedAnswerEvent,
  type QuizProgressSnapshot
} from '@/lib/quizProgressPersistence';
import { evaluateTypedAnswer, getQuestionAnswer } from '@/lib/quizAnswerEvaluation';
import {
  calculateAnswerTransition,
  QUIZ_SESSION_POLICY
} from '@/lib/quizSessionTransitions';
import { QuizSessionSync } from '@/lib/quizSessionSync';
import { useQuizTelemetry } from '@/hooks/useQuizTelemetry';

interface UseQuizSessionProps {
  quiz: Quiz;
  initialQuestions: QuizQuestion[];
  initialSession: QuizSession;
  initialProgress: QuestionProgress[];
  mode: QuizMode;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

export interface PendingQueueTransition {
  nextQueue: PracticeSessionState;
  progressMap: Map<string, QuestionProgress>;
  recapQuestionIds: string[];
}

function getProgressSourceId(questionId: string): string {
  return questionId.endsWith('-reverse') ? questionId.slice(0, -'-reverse'.length) : questionId;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]')
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]')
  );
}

const CORRECT_FEEDBACK_MESSAGES = [
  'Correct Answer!',
  'Excellent work!',
  'You nailed it!',
  'Great job!',
  'That is exactly right!',
  'Fantastic recall!',
  'YIS GALING TAINA',
  'Eyy! Baka Naka Naka ko yan',
  'Bangis pero di malangis!',
  'Ga is Ling!?',
  'GALING! Baka maging Cum Laude ka niyan',
  'Nice! Kuhang-kuha mo',
  'Tumagos nanaman! Galing',
  'Nice one babyy',
  'Korique!',
  'May bitaw ka ah',
  'Alam na alam mo ah'
];

const INCORRECT_FEEDBACK_MESSAGES = [
  "No problem. You're still learning!",
  'Good effort—keep going!',
  'Not quite, but you are getting closer!',
  'Keep trying—you can do this!',
  'A useful attempt. Review it and try again!',
  'Stay with it—you are making progress!',
  'No worries, Learning is a process',
  'Okay lang magkamali, bawi ka',
  'Go Vabee, kaya mo yan'
];

function getRandomFeedbackMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)] || messages[0];
}

export function useQuizSession({
  quiz,
  initialQuestions,
  initialSession,
  initialProgress,
  mode,
  shuffleQuestions = false,
  shuffleOptions = true
}: UseQuizSessionProps) {
  const processedQuestions = useMemo(() => {
    const optionReadyQuestions = mode === 'multiple_choice' || mode === 'reverse'
      ? QuizTransformService.prepareQuestionsForOptions(initialQuestions)
      : initialQuestions;

    return mode === 'reverse'
      ? QuizTransformService.generateReverseQuestions(optionReadyQuestions)
      : optionReadyQuestions;
  }, [initialQuestions, mode]);

  const [questions] = useState<QuizQuestion[]>(() => {
    if (shuffleQuestions) return [...processedQuestions].sort(() => Math.random() - 0.5);
    return processedQuestions;
  });
  const [session] = useState<QuizSession>(initialSession);
  const initialProgressMap = useMemo(() => {
    const sourceMap = new Map(initialProgress.map((progress) => [progress.question_id, progress]));
    return new Map(questions.map((question) => {
      const progress = sourceMap.get(question.id) || sourceMap.get(getProgressSourceId(question.id));
      return [question.id, progress];
    }).filter((entry): entry is [string, QuestionProgress] => Boolean(entry[1])));
  }, [initialProgress, questions]);

  const [progressMap, setProgressMap] = useState<Map<string, QuestionProgress>>(initialProgressMap);
  const [queueState, setQueueState] = useState<PracticeSessionState>(() => {
    const unlockedIds = questions
      .filter((question) => !initialProgressMap.get(question.id)?.locked)
      .map((question) => question.id);
    return CognitiveMasteryQueue.initialize(unlockedIds);
  });
  const [accumulatedStruggleIds, setAccumulatedStruggleIds] = useState<string[]>([]);
  const [isStruggleReviewMode, setIsStruggleReviewMode] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluatedCardIds, setEvaluatedCardIds] = useState<string[]>([]);
  const [pendingAdvance, setPendingAdvance] = useState<PendingQueueTransition | null>(null);
  const [isRecapVisible, setIsRecapVisible] = useState(false);
  const [isQuestionTransitioning, setIsQuestionTransitioning] = useState(false);
  const [identificationInput, setIdentificationInput] = useState('');
  const [identificationSubmitted, setIdentificationSubmitted] = useState(false);
  const [typedAnswerCorrect, setTypedAnswerCorrect] = useState<boolean | null>(null);
  const [answerResult, setAnswerResult] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [isExplanationVisible, setIsExplanationVisible] = useState(false);
  const [pendingAnswerEvents, setPendingAnswerEvents] = useState<PersistedAnswerEvent[]>([]);
  const [isProgressHydrated, setIsProgressHydrated] = useState(false);
  const [isCompleted, setIsCompleted] = useState(
    () => questions.length > 0 && MasteryEngineService.isAllQuestionsLocked(questions, initialProgressMap)
  );
  const [isMuted, setIsMuted] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<ShuffledOption[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionMasterySummary | null>(null);
  const [correctAnswerIds, setCorrectAnswerIds] = useState<Set<string>>(new Set());

  const telemetry = useQuizTelemetry();
  const questionStartTimeRef = useRef(Date.now());
  const restoringSnapshotRef = useRef<QuizProgressSnapshot | null>(null);
  const latestSnapshotRef = useRef<QuizProgressSnapshot | null>(null);
  const questionTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncClientRef = useRef(new QuizSessionSync());
  const celebrationFiredRef = useRef(false);
  const completionSyncStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (questionTransitionTimeoutRef.current) clearTimeout(questionTransitionTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const snapshot = readQuizProgressSnapshot(quiz.id, session.id);
    if (snapshot) {
      const knownQuestionIds = new Set(questions.map((question) => question.id));
      const snapshotQuestionIds = [
        ...snapshot.queueState.activeQueue,
        ...snapshot.queueState.completed,
        ...snapshot.queueState.strugglePile,
        ...(snapshot.queueState.unservedQueue || []),
        ...(snapshot.pendingAdvance?.nextQueue.activeQueue || []),
        ...(snapshot.pendingAdvance?.nextQueue.completed || []),
        ...(snapshot.pendingAdvance?.nextQueue.strugglePile || []),
        ...(snapshot.pendingAdvance?.nextQueue.unservedQueue || [])
      ];
      const isCompatible = snapshotQuestionIds.every((questionId) => knownQuestionIds.has(questionId));

      if (isCompatible) {
        restoringSnapshotRef.current = snapshot;
        setProgressMap(new Map(snapshot.progressEntries));
        setQueueState(snapshot.queueState);
        setAccumulatedStruggleIds(snapshot.accumulatedStruggleIds);
        setIsStruggleReviewMode(snapshot.isStruggleReviewMode);
        setEvaluatedCardIds(snapshot.evaluatedCardIds);
        setPendingAdvance(snapshot.pendingAdvance
          ? {
              nextQueue: snapshot.pendingAdvance.nextQueue,
              progressMap: new Map(snapshot.pendingAdvance.progressEntries),
              recapQuestionIds: snapshot.pendingAdvance.recapQuestionIds
            }
          : null);
        setIsRecapVisible(snapshot.isRecapVisible);
        setIsEvaluating(snapshot.isEvaluating);
        setIsCardFlipped(snapshot.isCardFlipped);
        setSelectedOptionId(snapshot.selectedOptionId);
        setIdentificationInput(snapshot.identificationInput);
        setIdentificationSubmitted(snapshot.identificationSubmitted);
        setTypedAnswerCorrect(snapshot.typedAnswerCorrect);
        setAnswerResult(snapshot.answerResult);
        setCorrectAnswerIds(new Set(snapshot.correctAnswerIds));
        setFeedbackMessage(snapshot.feedbackMessage);
        setIsHintVisible(snapshot.isHintVisible);
        setIsExplanationVisible(snapshot.isExplanationVisible);
        setIsCompleted(snapshot.isCompleted);
        telemetry.restore(snapshot.cardTelemetry);
        setPendingAnswerEvents(snapshot.pendingAnswerEvents);
      } else {
        removeQuizProgressSnapshot(quiz.id, session.id);
      }
    }

    setIsProgressHydrated(true);
  }, [quiz.id, session.id, questions]);

  useEffect(() => {
    setIsMuted(quizAudio.isMuted());
    quizAudio.preload();
    const unsubscribe = quizAudio.subscribe((muted) => setIsMuted(muted));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isProgressHydrated || !isCompleted || celebrationFiredRef.current) return;
    celebrationFiredRef.current = true;
    quizAudio.playSuccessSound();
    triggerCelebrationConfetti();
  }, [isCompleted, isProgressHydrated]);

  useEffect(() => {
    if (!isProgressHydrated || !isCompleted || sessionSummary) return;
    setSessionSummary(telemetry.generateSummary(questions));
  }, [isCompleted, isProgressHydrated, questions, sessionSummary]);

  const activeQuestionId = CognitiveMasteryQueue.getCurrentQuestionId(queueState);
  const activeQuestion = activeQuestionId
    ? questions.find((question) => question.id === activeQuestionId) || null
    : null;
  const currentProg = activeQuestion ? progressMap.get(activeQuestion.id) || null : null;
  const isRetryQuestion = Boolean(
    activeQuestion && (
      (queueState.attemptsByQuestion[activeQuestion.id] || 0) > 0 ||
      accumulatedStruggleIds.includes(activeQuestion.id)
    )
  );

  useEffect(() => {
    questionStartTimeRef.current = Date.now();
  }, [activeQuestion?.id]);

  const correctAnswerIdsRef = useRef(correctAnswerIds);
  correctAnswerIdsRef.current = correctAnswerIds;

  function persistCurrentSnapshot(): void {
    if (!isProgressHydrated) return;
    const snapshot: QuizProgressSnapshot = {
      version: 1,
      quizId: quiz.id,
      sessionId: session.id,
      queueState,
      progressEntries: Array.from(progressMap.entries()),
      accumulatedStruggleIds,
      isStruggleReviewMode,
      evaluatedCardIds,
      pendingAdvance: pendingAdvance
        ? {
            nextQueue: pendingAdvance.nextQueue,
            progressEntries: Array.from(pendingAdvance.progressMap.entries()),
            recapQuestionIds: pendingAdvance.recapQuestionIds
          }
        : null,
      isRecapVisible,
      isEvaluating,
      isCardFlipped,
      selectedOptionId,
      identificationInput,
      identificationSubmitted,
      typedAnswerCorrect,
      answerResult,
      correctAnswerIds: Array.from(correctAnswerIdsRef.current),
      feedbackMessage,
      isHintVisible,
      isExplanationVisible,
      isCompleted,
      cardTelemetry: telemetry.recordsRef.current,
      pendingAnswerEvents,
      savedAt: new Date().toISOString()
    };
    latestSnapshotRef.current = snapshot;
    writeQuizProgressSnapshot(snapshot);
  }

  useEffect(() => {
    if (!isProgressHydrated) return;
    persistCurrentSnapshot();
  }, [
    isProgressHydrated,
    queueState,
    progressMap,
    accumulatedStruggleIds,
    isStruggleReviewMode,
    evaluatedCardIds,
    pendingAdvance,
    isRecapVisible,
    isEvaluating,
    isCardFlipped,
    selectedOptionId,
    identificationInput,
    identificationSubmitted,
    typedAnswerCorrect,
    answerResult,
    correctAnswerIds,
    feedbackMessage,
    isHintVisible,
    isExplanationVisible,
    isCompleted,
    telemetry.records,
    pendingAnswerEvents
  ]);

  async function syncAnswerEvent(event: PersistedAnswerEvent): Promise<void> {
    const synced = await syncClientRef.current.syncAnswer(event);
    if (synced) {
      setPendingAnswerEvents((current) => current.filter((pending) => pending.id !== event.id));
    }
  }

  useEffect(() => {
    if (!isProgressHydrated) return;

    const flushPendingAnswers = () => {
      pendingAnswerEvents.forEach((event) => void syncAnswerEvent(event));
    };
    flushPendingAnswers();

    window.addEventListener('online', flushPendingAnswers);
    const handlePageHide = () => {
      if (latestSnapshotRef.current) writeQuizProgressSnapshot(latestSnapshotRef.current);
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('online', flushPendingAnswers);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isProgressHydrated, pendingAnswerEvents]);

  useEffect(() => {
    if (!activeQuestion) return;
    setCurrentOptions(shuffleOptions
      ? QuizShuffleService.shuffleOptions(activeQuestion.options, activeQuestion.correct_answer)
      : activeQuestion.options.map((text, index) => ({
          optionId: index,
          text,
          isCorrect: index === activeQuestion.correct_answer
        })));

    const restoredSnapshot = restoringSnapshotRef.current;
    if (restoredSnapshot?.queueState.activeQueue[0] === activeQuestion.id) {
      setIsEvaluating(restoredSnapshot.isEvaluating);
      setIsCardFlipped(restoredSnapshot.isCardFlipped);
      setSelectedOptionId(restoredSnapshot.selectedOptionId);
      setIdentificationInput(restoredSnapshot.identificationInput);
      setIdentificationSubmitted(restoredSnapshot.identificationSubmitted);
      setTypedAnswerCorrect(restoredSnapshot.typedAnswerCorrect);
      setAnswerResult(restoredSnapshot.answerResult);
      setFeedbackMessage(restoredSnapshot.feedbackMessage);
      setIsHintVisible(restoredSnapshot.isHintVisible);
      setIsExplanationVisible(restoredSnapshot.isExplanationVisible);
      restoringSnapshotRef.current = null;
      return;
    }

    setSelectedOptionId(null);
    setIsEvaluating(false);
    setIsCardFlipped(false);
    setIdentificationInput('');
    setIdentificationSubmitted(false);
    setTypedAnswerCorrect(null);
    setAnswerResult(null);
    setFeedbackMessage(null);
    setIsHintVisible(false);
    setIsExplanationVisible(false);
  }, [activeQuestion?.id, shuffleOptions]);

  function startStruggleReview(ids: string[] = accumulatedStruggleIds): void {
    if (ids.length === 0) return;
    setAccumulatedStruggleIds(ids);
    setIsCompleted(false);
    celebrationFiredRef.current = false;
    completionSyncStartedRef.current = false;
    setIsStruggleReviewMode(true);
    setQueueState(CognitiveMasteryQueue.initialize(ids));
  }

  function answerQuestion(option: ShuffledOption | undefined): void {
    if (!isProgressHydrated || !option || isEvaluating || !activeQuestion || !currentProg) return;

    setIsEvaluating(true);
    setSelectedOptionId(option.optionId);
    setAnswerResult(option.isCorrect);
    setFeedbackMessage(getRandomFeedbackMessage(
      option.isCorrect ? CORRECT_FEEDBACK_MESSAGES : INCORRECT_FEEDBACK_MESSAGES
    ));

    const latencyMs = Math.max(1, Date.now() - questionStartTimeRef.current);
    const questionId = activeQuestion.id;
    if (option.isCorrect) {
      setCorrectAnswerIds((previous) => {
        if (previous.has(questionId)) return previous;
        const next = new Set(previous);
        next.add(questionId);
        return next;
      });
    }

    telemetry.recordAnswer(activeQuestion, option.isCorrect, latencyMs);
    if (option.isCorrect) quizAudio.playCorrectSound();

    const transition = calculateAnswerTransition({
      question: activeQuestion,
      currentProgress: currentProg,
      progressMap,
      queueState,
      evaluatedCardIds,
      isCorrect: option.isCorrect,
      sessionType: session.session_type
    });

    setProgressMap(transition.progressMap);
    if (transition.queueOutcome === 'struggle_pile') {
      setAccumulatedStruggleIds((previous) => Array.from(new Set([...previous, questionId])));
    }
    setEvaluatedCardIds(transition.evaluatedCardIds);
    setPendingAdvance({
      nextQueue: transition.queueState,
      progressMap: transition.progressMap,
      recapQuestionIds: transition.recapQuestionIds
    });

    const event: PersistedAnswerEvent = {
      id: createAnswerEventId(),
      sessionId: session.id,
      questionId: getProgressSourceId(questionId),
      isCorrect: option.isCorrect,
      sessionType: session.session_type,
      latencyMs,
      createdAt: new Date().toISOString()
    };
    setPendingAnswerEvents((current) => [...current, event]);
    void syncAnswerEvent(event);
  }

  function applyQueueTransition(nextQueue: PracticeSessionState, map: Map<string, QuestionProgress>): void {
    setIsEvaluating(false);
    setSelectedOptionId(null);
    setAnswerResult(null);
    setFeedbackMessage(null);
    setIsHintVisible(false);
    setIsExplanationVisible(false);
    setQueueState(nextQueue);

    if (!CognitiveMasteryQueue.isRoundFinished(nextQueue)) return;

    if (isStruggleReviewMode) {
      setIsStruggleReviewMode(false);
      complete();
      return;
    }

    if (MasteryEngineService.isAllQuestionsLocked(questions, map)) {
      complete();
      return;
    }

    const struggleIds = Array.from(new Set([
      ...accumulatedStruggleIds,
      ...nextQueue.strugglePile
    ]));
    if (struggleIds.length > 0) startStruggleReview(struggleIds);
    else complete();
  }

  function advance(): void {
    if (!pendingAdvance) return;

    if (isRecapVisible) {
      const transition = pendingAdvance;
      setIsRecapVisible(false);
      setPendingAdvance(null);
      setEvaluatedCardIds([]);
      applyQueueTransition(transition.nextQueue, transition.progressMap);
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
      applyQueueTransition(transition.nextQueue, transition.progressMap);
      setIsQuestionTransitioning(false);
    }, QUIZ_SESSION_POLICY.questionExitDurationMs);
  }

  function submitTypedAnswer(answerMode: 'learn' | 'identification'): void {
    if (!isProgressHydrated || isEvaluating || !activeQuestion || !currentProg || !identificationInput.trim()) return;
    const isCorrect = evaluateTypedAnswer(
      identificationInput,
      getQuestionAnswer(activeQuestion),
      answerMode
    );
    setTypedAnswerCorrect(isCorrect);
    setIdentificationSubmitted(true);
    answerQuestion({
      optionId: activeQuestion.correct_answer,
      text: identificationInput,
      isCorrect
    });
  }

  async function complete(): Promise<void> {
    if (completionSyncStartedRef.current) return;
    completionSyncStartedRef.current = true;
    setIsCompleted(true);
    const summary = telemetry.generateSummary(questions);
    setSessionSummary(summary);

    if (!celebrationFiredRef.current) {
      celebrationFiredRef.current = true;
      quizAudio.playSuccessSound();
      triggerCelebrationConfetti();
    }

    const synced = await syncClientRef.current.completeSession(session, quiz.id, summary);
    if (synced && pendingAnswerEvents.length === 0) {
      removeQuizProgressSnapshot(quiz.id, session.id);
    }
  }

  function handleSurfaceClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!isInteractiveTarget(event.target)) advance();
  }

  function handleSurfaceKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (isInteractiveTarget(event.target)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      advance();
    }
  }

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent): void {
      if (!isProgressHydrated || isTypingTarget(event.target)) return;

      if (pendingAdvance) {
        if (event.key === 'Tab' || event.metaKey || event.ctrlKey || event.altKey) return;
        event.preventDefault();
        advance();
        return;
      }

      if (isEvaluating || (mode !== 'multiple_choice' && mode !== 'reverse')) return;
      if (event.key.toLowerCase() === 'h') {
        if (isEvaluating || answerResult !== null) return;
        event.preventDefault();
        setIsHintVisible(true);
        return;
      }

      const choiceIndex = Number.parseInt(event.key, 10) - 1;
      if (choiceIndex < 0 || choiceIndex >= currentOptions.length) return;
      event.preventDefault();
      answerQuestion(currentOptions[choiceIndex]);
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    currentOptions,
    answerResult,
    isEvaluating,
    isProgressHydrated,
    mode,
    pendingAdvance
  ]);

  return {
    questions,
    session,
    progressMap,
    queueState,
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
    pendingAnswerEvents,
    isProgressHydrated,
    isCompleted,
    isMuted,
    cardTelemetry: telemetry.records,
    sessionSummary: sessionSummary || telemetry.generateSummary(questions),
    setIsCardFlipped,
    setIdentificationInput,
    setIsHintVisible,
    setIsExplanationVisible,
    answerQuestion,
    submitTypedAnswer,
    advance,
    startStruggleReview,
    complete,
    handleSurfaceClick,
    handleSurfaceKeyDown,
    toggleMute: () => quizAudio.toggleMute()
  };
}

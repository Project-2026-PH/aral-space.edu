import {
  CognitiveMasteryQueue,
  MasteryEngineService
} from '@quiz-creator/core';
import type {
  PracticeSessionState,
  QuestionProgress,
  QuizQuestion,
  SessionType
} from '@quiz-creator/types';

export const QUIZ_SESSION_POLICY = {
  questionExitDurationMs: 180,
  questionsPerReviewRound: 7,
  queue: {
    reinsertOffset: 3,
    maxAttempts: 3,
    windowSize: 7
  }
} as const;

export interface AnswerTransitionInput {
  question: QuizQuestion;
  currentProgress: QuestionProgress;
  progressMap: Map<string, QuestionProgress>;
  queueState: PracticeSessionState;
  evaluatedCardIds: string[];
  isCorrect: boolean;
  sessionType: SessionType;
}

export interface AnswerTransition {
  updatedProgress: QuestionProgress;
  progressMap: Map<string, QuestionProgress>;
  queueState: PracticeSessionState;
  queueOutcome: ReturnType<typeof CognitiveMasteryQueue.recordResult>['outcome'];
  evaluatedCardIds: string[];
  recapQuestionIds: string[];
}

/**
 * Coordinates the existing domain services without knowing about React,
 * persistence, audio, or presentation. All queue/mastery constants remain the
 * policies used by the original runner.
 */
export function calculateAnswerTransition(input: AnswerTransitionInput): AnswerTransition {
  const nextProgressData = MasteryEngineService.calculateNextProgress(
    input.currentProgress,
    input.isCorrect,
    input.sessionType
  );
  const updatedProgress: QuestionProgress = {
    ...input.currentProgress,
    ...nextProgressData
  };

  const progressMap = new Map(input.progressMap);
  progressMap.set(input.question.id, updatedProgress);

  const queueResult = CognitiveMasteryQueue.recordResult(
    input.queueState,
    input.question.id,
    input.isCorrect,
    QUIZ_SESSION_POLICY.queue
  );

  const nextEvaluatedCardIds = input.evaluatedCardIds.includes(input.question.id)
    ? input.evaluatedCardIds
    : [...input.evaluatedCardIds, input.question.id];
  const recapQuestionIds = nextEvaluatedCardIds.length >= QUIZ_SESSION_POLICY.questionsPerReviewRound
    ? nextEvaluatedCardIds.slice(0, QUIZ_SESSION_POLICY.questionsPerReviewRound)
    : [];

  return {
    updatedProgress,
    progressMap,
    queueState: queueResult.nextState,
    queueOutcome: queueResult.outcome,
    evaluatedCardIds: recapQuestionIds.length > 0 ? [] : nextEvaluatedCardIds,
    recapQuestionIds
  };
}

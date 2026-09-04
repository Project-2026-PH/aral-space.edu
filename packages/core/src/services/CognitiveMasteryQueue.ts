import { PracticeSessionState } from '@quiz-creator/types';

export interface RecordResultOptions {
  reinsertOffset?: number; // default 3
  maxAttempts?: number;   // default 3
  windowSize?: number;    // default 7
}

export type MasteryOutcome = 'completed' | 'reinserted' | 'struggle_pile';

export interface RecordResultResult {
  nextState: PracticeSessionState;
  outcome: MasteryOutcome;
  questionId: string;
}

/**
 * CognitiveMasteryQueue
 * Implements Phase 1 of the Cognitive Mastery Loop:
 * - 7-Item Dynamic Sliding Window (working memory buffer)
 * - 3-position Leitner-style reinsertion on incorrect answers
 * - Anti-fatigue struggle pile escalation on 3 misses
 * - Round completion when active and unserved queues are exhausted
 */
export class CognitiveMasteryQueue {
  public static readonly DEFAULT_WINDOW_SIZE = 7;
  public static readonly DEFAULT_REINSERTION_OFFSET = 3;
  public static readonly DEFAULT_MAX_ATTEMPTS = 3;

  /**
   * Initializes a PracticeSessionState with up to windowSize cards in activeQueue
   * and the rest in unservedQueue.
   */
  static initialize(
    questionIds: string[],
    windowSize: number = CognitiveMasteryQueue.DEFAULT_WINDOW_SIZE
  ): PracticeSessionState {
    const uniqueIds = Array.from(new Set(questionIds));
    const active = uniqueIds.slice(0, windowSize);
    const unserved = uniqueIds.slice(windowSize);
    const attempts: Record<string, number> = {};
    for (const id of uniqueIds) {
      attempts[id] = 0;
    }

    return {
      activeQueue: active,
      completed: [],
      strugglePile: [],
      attemptsByQuestion: attempts,
      unservedQueue: unserved
    };
  }

  /**
   * Returns the question ID currently at the front of activeQueue, or null if empty.
   */
  static getCurrentQuestionId(state: PracticeSessionState): string | null {
    return state.activeQueue[0] || null;
  }

  /**
   * Records whether the question was answered correctly or not, and updates state immutably:
   * - If correct: adds to completed, removes from active, pulls next from unserved if available.
   * - If incorrect: increments attempt count.
   *   - If attempts >= maxAttempts (default 3): removes from active, adds to strugglePile, pulls next from unserved.
   *   - Else: reinserts card 3 positions ahead in activeQueue (or end if queue is shorter).
   */
  static recordResult(
    state: PracticeSessionState,
    questionId: string,
    isCorrect: boolean,
    options?: RecordResultOptions
  ): RecordResultResult {
    const windowSize = options?.windowSize ?? CognitiveMasteryQueue.DEFAULT_WINDOW_SIZE;
    const reinsertOffset = options?.reinsertOffset ?? CognitiveMasteryQueue.DEFAULT_REINSERTION_OFFSET;
    const maxAttempts = options?.maxAttempts ?? CognitiveMasteryQueue.DEFAULT_MAX_ATTEMPTS;

    const unserved = [...(state.unservedQueue || [])];
    const completed = [...state.completed];
    const strugglePile = [...state.strugglePile];
    const attempts = { ...state.attemptsByQuestion };

    // Find and remove questionId from activeQueue
    const activeIndex = state.activeQueue.indexOf(questionId);
    const active = [...state.activeQueue];

    if (activeIndex !== -1) {
      active.splice(activeIndex, 1);
    }

    if (isCorrect) {
      if (!completed.includes(questionId)) {
        completed.push(questionId);
      }

      // Replenish activeQueue from unservedQueue to maintain sliding window size
      while (active.length < windowSize && unserved.length > 0) {
        const nextId = unserved.shift()!;
        active.push(nextId);
      }

      return {
        nextState: {
          activeQueue: active,
          completed,
          strugglePile,
          attemptsByQuestion: attempts,
          unservedQueue: unserved
        },
        outcome: 'completed',
        questionId
      };
    } else {
      const currentAttempts = (attempts[questionId] || 0) + 1;
      attempts[questionId] = currentAttempts;

      if (currentAttempts >= maxAttempts) {
        // Escalate to Struggle Pile
        if (!strugglePile.includes(questionId)) {
          strugglePile.push(questionId);
        }

        // Replenish from unservedQueue
        while (active.length < windowSize && unserved.length > 0) {
          const nextId = unserved.shift()!;
          active.push(nextId);
        }

        return {
          nextState: {
            activeQueue: active,
            completed,
            strugglePile,
            attemptsByQuestion: attempts,
            unservedQueue: unserved
          },
          outcome: 'struggle_pile',
          questionId
        };
      } else {
        // Reinsert Leitner-style 3 positions ahead
        const insertIndex = Math.min(reinsertOffset, active.length);
        active.splice(insertIndex, 0, questionId);

        return {
          nextState: {
            activeQueue: active,
            completed,
            strugglePile,
            attemptsByQuestion: attempts,
            unservedQueue: unserved
          },
          outcome: 'reinserted',
          questionId
        };
      }
    }
  }

  /**
   * Checks whether the active batch/round is finished (activeQueue and unservedQueue both empty).
   */
  static isRoundFinished(state: PracticeSessionState): boolean {
    return state.activeQueue.length === 0 && (!state.unservedQueue || state.unservedQueue.length === 0);
  }
}

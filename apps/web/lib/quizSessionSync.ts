import type { PersistedAnswerEvent } from '@/lib/quizProgressPersistence';
import type { QuizSession, SessionMasterySummary } from '@quiz-creator/types';

/** Infrastructure boundary for the existing sessions API contract. */
export class QuizSessionSync {
  private readonly syncingAnswerIds = new Set<string>();

  async syncAnswer(event: PersistedAnswerEvent): Promise<boolean> {
    if (this.syncingAnswerIds.has(event.id)) return false;
    this.syncingAnswerIds.add(event.id);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          sessionId: event.sessionId,
          questionId: event.questionId,
          isCorrect: event.isCorrect,
          selectedOptionId: event.selectedOptionId,
          answerText: event.answerText,
          answerMode: event.answerMode,
          sessionType: event.sessionType,
          latencyMs: event.latencyMs,
          clientEventId: event.id
        })
      });

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.warn('[QuizRunner] Session event stale or unprocessable, discarding answer event:', event.id, 'status:', response.status);
          return true; // Discard stale or unprocessable event from pending queue
        }
        throw new Error(`Answer sync failed with status ${response.status}`);
      }

      return true;
    } catch (error) {
      console.warn('[QuizRunner] Answer will retry when the connection is available:', error);
      return false;
    } finally {
      this.syncingAnswerIds.delete(event.id);
    }
  }

  async completeSession(
    session: QuizSession,
    quizId: string,
    summary: SessionMasterySummary
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          sessionId: session.id,
          quizId,
          summary
        })
      });

      if (!response.ok) {
        throw new Error(`Session completion sync failed with status ${response.status}`);
      }

      return true;
    } catch (error) {
      console.warn('Session complete sync error:', error);
      return false;
    }
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSessionSync } from '../quizSessionSync';
import type { PersistedAnswerEvent } from '../quizProgressPersistence';

describe('QuizSessionSync', () => {
  const sync = new QuizSessionSync();
  const baseEvent: PersistedAnswerEvent = {
    id: 'event-1',
    sessionId: 'session-1',
    questionId: 'q-1',
    isCorrect: false,
    selectedOptionId: -1,
    sessionType: 'initial',
    latencyMs: 1200,
    createdAt: new Date().toISOString()
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discards unprocessable 400 answer events instead of retrying', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400
    } as Response);

    const result = await sync.syncAnswer(baseEvent);
    expect(result).toBe(true);
  });

  it('discards expired 404/403 answer events', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404
    } as Response);

    const result = await sync.syncAnswer(baseEvent);
    expect(result).toBe(true);
  });

  it('retries on 500 server errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500
    } as Response);

    const result = await sync.syncAnswer(baseEvent);
    expect(result).toBe(false);
  });

  it('retries on 429 rate limit errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429
    } as Response);

    const result = await sync.syncAnswer(baseEvent);
    expect(result).toBe(false);
  });

  it('returns true on 200 success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    } as Response);

    const result = await sync.syncAnswer(baseEvent);
    expect(result).toBe(true);
  });
});

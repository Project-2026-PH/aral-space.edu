import { describe, it, expect } from 'vitest';
import { CognitiveMasteryQueue } from '../CognitiveMasteryQueue';

describe('CognitiveMasteryQueue (Phase 1 — The Cognitive Mastery Loop)', () => {
  it('initializes a 7-item dynamic sliding window from question IDs', () => {
    const ids = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];
    const state = CognitiveMasteryQueue.initialize(ids, 7);

    expect(state.activeQueue).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']);
    expect(state.unservedQueue).toEqual(['q8', 'q9', 'q10']);
    expect(state.completed).toEqual([]);
    expect(state.strugglePile).toEqual([]);
    expect(state.attemptsByQuestion['q1']).toBe(0);
    expect(CognitiveMasteryQueue.getCurrentQuestionId(state)).toBe('q1');
  });

  it('handles question pools smaller than 7 items', () => {
    const ids = ['q1', 'q2', 'q3'];
    const state = CognitiveMasteryQueue.initialize(ids, 7);

    expect(state.activeQueue).toEqual(['q1', 'q2', 'q3']);
    expect(state.unservedQueue).toEqual([]);
    expect(CognitiveMasteryQueue.isRoundFinished(state)).toBe(false);
  });

  it('marks card as completed and pulls next card from unserved sliding window on correct answer', () => {
    const ids = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
    const state = CognitiveMasteryQueue.initialize(ids, 7);

    const result = CognitiveMasteryQueue.recordResult(state, 'q1', true);
    expect(result.outcome).toBe('completed');
    expect(result.nextState.completed).toEqual(['q1']);
    // q1 is removed, q8 is pulled in, active queue remains 7 items
    expect(result.nextState.activeQueue).toEqual(['q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
    expect(result.nextState.unservedQueue).toEqual([]);
    expect(CognitiveMasteryQueue.getCurrentQuestionId(result.nextState)).toBe('q2');
  });

  it('reinserts incorrect card Leitner-style 3 positions ahead in active queue', () => {
    const ids = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];
    const state = CognitiveMasteryQueue.initialize(ids, 7);

    // Initial queue: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']
    // Miss q1:
    // Remaining active: ['q2', 'q3', 'q4', 'q5', 'q6', 'q7']
    // Reinsert 3 positions ahead -> index 3 (after q4): ['q2', 'q3', 'q4', 'q1', 'q5', 'q6', 'q7']
    const result = CognitiveMasteryQueue.recordResult(state, 'q1', false);
    expect(result.outcome).toBe('reinserted');
    expect(result.nextState.activeQueue).toEqual(['q2', 'q3', 'q4', 'q1', 'q5', 'q6', 'q7']);
    expect(result.nextState.attemptsByQuestion['q1']).toBe(1);
    expect(result.nextState.completed).toEqual([]);
    expect(result.nextState.strugglePile).toEqual([]);
  });

  it('reinserts at end if active queue has fewer than 3 items remaining', () => {
    const ids = ['q1', 'q2'];
    const state = CognitiveMasteryQueue.initialize(ids, 7);

    const result = CognitiveMasteryQueue.recordResult(state, 'q1', false);
    expect(result.outcome).toBe('reinserted');
    expect(result.nextState.activeQueue).toEqual(['q2', 'q1']);
  });

  it('escalates card to Struggle Pile upon 3rd failed attempt and continues round', () => {
    const ids = ['q1', 'q2', 'q3', 'q4'];
    let state = CognitiveMasteryQueue.initialize(ids, 7);

    // Miss 1
    let res = CognitiveMasteryQueue.recordResult(state, 'q1', false);
    expect(res.outcome).toBe('reinserted');
    expect(res.nextState.attemptsByQuestion['q1']).toBe(1);
    state = res.nextState;

    // Miss 2
    res = CognitiveMasteryQueue.recordResult(state, 'q1', false);
    expect(res.outcome).toBe('reinserted');
    expect(res.nextState.attemptsByQuestion['q1']).toBe(2);
    state = res.nextState;

    // Miss 3: 3rd attempt cap reached -> Struggle Pile escalation
    res = CognitiveMasteryQueue.recordResult(state, 'q1', false);
    expect(res.outcome).toBe('struggle_pile');
    expect(res.nextState.attemptsByQuestion['q1']).toBe(3);
    expect(res.nextState.strugglePile).toEqual(['q1']);
    expect(res.nextState.activeQueue.includes('q1')).toBe(false);
  });

  it('replenishes sliding window from unserved queue when a card moves to Struggle Pile', () => {
    const ids = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
    const state = CognitiveMasteryQueue.initialize(ids, 7);
    state.attemptsByQuestion['q1'] = 2; // already missed twice

    const res = CognitiveMasteryQueue.recordResult(state, 'q1', false);
    expect(res.outcome).toBe('struggle_pile');
    expect(res.nextState.strugglePile).toEqual(['q1']);
    // q1 is out, q8 slides in
    expect(res.nextState.activeQueue).toEqual(['q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
    expect(res.nextState.unservedQueue).toEqual([]);
  });

  it('finishes round only when activeQueue and unservedQueue are both empty', () => {
    const ids = ['q1', 'q2'];
    let state = CognitiveMasteryQueue.initialize(ids, 7);
    expect(CognitiveMasteryQueue.isRoundFinished(state)).toBe(false);

    // q1 correct
    state = CognitiveMasteryQueue.recordResult(state, 'q1', true).nextState;
    expect(CognitiveMasteryQueue.isRoundFinished(state)).toBe(false);

    // q2 missed 3 times -> moves to struggle pile
    state = CognitiveMasteryQueue.recordResult(state, 'q2', false).nextState;
    state = CognitiveMasteryQueue.recordResult(state, 'q2', false).nextState;
    state = CognitiveMasteryQueue.recordResult(state, 'q2', false).nextState;

    expect(state.completed).toEqual(['q1']);
    expect(state.strugglePile).toEqual(['q2']);
    expect(state.activeQueue).toEqual([]);
    expect(CognitiveMasteryQueue.isRoundFinished(state)).toBe(true);
  });
});

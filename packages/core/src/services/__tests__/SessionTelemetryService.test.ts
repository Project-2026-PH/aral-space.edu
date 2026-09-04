import { describe, it, expect } from 'vitest';
import { SessionTelemetryService } from '../SessionTelemetryService';
import { CardTelemetryRecord } from '@quiz-creator/types';

describe('SessionTelemetryService', () => {
  describe('calculateMedianLatency', () => {
    it('returns 0 for empty array or array with only invalid values', () => {
      expect(SessionTelemetryService.calculateMedianLatency([])).toBe(0);
      expect(SessionTelemetryService.calculateMedianLatency([0, -10, NaN])).toBe(0);
    });

    it('calculates median for odd number of values', () => {
      expect(SessionTelemetryService.calculateMedianLatency([3000, 1000, 2000])).toBe(2000);
      expect(SessionTelemetryService.calculateMedianLatency([5000])).toBe(5000);
    });

    it('calculates median for even number of values by averaging middle two', () => {
      expect(SessionTelemetryService.calculateMedianLatency([1000, 2000, 4000, 5000])).toBe(3000);
      expect(SessionTelemetryService.calculateMedianLatency([1000, 3000])).toBe(2000);
    });
  });

  describe('isHesitant', () => {
    it('returns false when deckMedianLatencyMs <= 0 or latency <= 0', () => {
      expect(SessionTelemetryService.isHesitant(1000, 0)).toBe(false);
      expect(SessionTelemetryService.isHesitant(0, 2000)).toBe(false);
    });

    it('returns true when latency exceeds 1.5x deck median', () => {
      // 1.5 * 2000 = 3000
      expect(SessionTelemetryService.isHesitant(3001, 2000)).toBe(true);
      expect(SessionTelemetryService.isHesitant(5000, 2000)).toBe(true);
    });

    it('returns false when latency is within 1.5x deck median', () => {
      expect(SessionTelemetryService.isHesitant(3000, 2000)).toBe(false);
      expect(SessionTelemetryService.isHesitant(1500, 2000)).toBe(false);
    });
  });

  describe('evaluateCardBucket', () => {
    const deckMedianMs = 2000;

    it('buckets cards with >= 2 misses into Red (At-Risk)', () => {
      const record: CardTelemetryRecord = {
        questionId: 'q-1',
        firstPassCorrect: false,
        totalAttempts: 3,
        totalMisses: 2,
        timeToCorrectMs: 1800,
        conceptTags: ['tagA']
      };
      expect(SessionTelemetryService.evaluateCardBucket(record, deckMedianMs)).toBe('red');
    });

    it('buckets unmastered/unresolved cards into Red (At-Risk)', () => {
      const record: CardTelemetryRecord = {
        questionId: 'q-unresolved',
        firstPassCorrect: false,
        totalAttempts: 1,
        totalMisses: 1,
        timeToCorrectMs: undefined, // not resolved
        conceptTags: ['tagA']
      };
      expect(SessionTelemetryService.evaluateCardBucket(record, deckMedianMs)).toBe('red');
    });

    it('buckets unattempted cards into Red', () => {
      const record: CardTelemetryRecord = {
        questionId: 'q-empty',
        firstPassCorrect: false,
        totalAttempts: 0,
        totalMisses: 0,
        conceptTags: ['tagA']
      };
      expect(SessionTelemetryService.evaluateCardBucket(record, deckMedianMs)).toBe('red');
    });

    it('buckets first-pass miss resolved on retry into Yellow (Frail/Recovered)', () => {
      const record: CardTelemetryRecord = {
        questionId: 'q-recovered',
        firstPassCorrect: false,
        totalAttempts: 2,
        totalMisses: 1,
        timeToCorrectMs: 1600,
        conceptTags: ['tagA']
      };
      expect(SessionTelemetryService.evaluateCardBucket(record, deckMedianMs)).toBe('yellow');
    });

    it('buckets first-pass correct with hesitation (> 1.5x median) into Yellow (Hesitant)', () => {
      const record: CardTelemetryRecord = {
        questionId: 'q-hesitant',
        firstPassCorrect: true,
        totalAttempts: 1,
        totalMisses: 0,
        timeToCorrectMs: 3500, // > 1.5 * 2000 = 3000
        conceptTags: ['tagA']
      };
      expect(SessionTelemetryService.evaluateCardBucket(record, deckMedianMs)).toBe('yellow');
    });

    it('buckets first-pass correct within threshold (<= 1.5x median) into Green (Mastered)', () => {
      const record: CardTelemetryRecord = {
        questionId: 'q-mastered',
        firstPassCorrect: true,
        totalAttempts: 1,
        totalMisses: 0,
        timeToCorrectMs: 1800, // <= 3000
        conceptTags: ['tagA']
      };
      expect(SessionTelemetryService.evaluateCardBucket(record, deckMedianMs)).toBe('green');
    });
  });

  describe('computeConceptErrorDensity', () => {
    it('aggregates misses across shared tags', () => {
      const records: CardTelemetryRecord[] = [
        {
          questionId: 'q-1',
          firstPassCorrect: false,
          totalAttempts: 3,
          totalMisses: 2,
          timeToCorrectMs: 2000,
          conceptTags: ['working-memory', 'sliding-window']
        },
        {
          questionId: 'q-2',
          firstPassCorrect: false,
          totalAttempts: 2,
          totalMisses: 1,
          timeToCorrectMs: 1500,
          conceptTags: ['sliding-window', 'mastery-criteria']
        },
        {
          questionId: 'q-3',
          firstPassCorrect: true,
          totalAttempts: 1,
          totalMisses: 0,
          timeToCorrectMs: 1200,
          conceptTags: ['mastery-criteria']
        }
      ];

      const density = SessionTelemetryService.computeConceptErrorDensity(records);
      expect(density['working-memory']).toBe(2);
      expect(density['sliding-window']).toBe(3);
      expect(density['mastery-criteria']).toBe(1);
    });
  });

  describe('generateSessionSummary', () => {
    it('builds complete session mastery summary with deck median, buckets, and error density', () => {
      const records: CardTelemetryRecord[] = [
        {
          questionId: 'q-1',
          firstPassCorrect: true,
          totalAttempts: 1,
          totalMisses: 0,
          timeToCorrectMs: 1500,
          conceptTags: ['tag1']
        },
        {
          questionId: 'q-2',
          firstPassCorrect: true,
          totalAttempts: 1,
          totalMisses: 0,
          timeToCorrectMs: 4000, // hesitant
          conceptTags: ['tag1', 'tag2']
        },
        {
          questionId: 'q-3',
          firstPassCorrect: false,
          totalAttempts: 2,
          totalMisses: 1,
          timeToCorrectMs: 2000,
          conceptTags: ['tag2']
        },
        {
          questionId: 'q-4',
          firstPassCorrect: false,
          totalAttempts: 3,
          totalMisses: 2,
          timeToCorrectMs: 2200,
          conceptTags: ['tag3']
        }
      ];

      // Latencies: [1500, 2000, 2200, 4000] -> median: (2000 + 2200) / 2 = 2100
      // Hesitation threshold: 1.5 * 2100 = 3150
      // q-1: 1500 <= 3150 -> green
      // q-2: 4000 > 3150 -> yellow (hesitant)
      // q-3: 1 miss resolved -> yellow
      // q-4: 2 misses -> red
      const summary = SessionTelemetryService.generateSessionSummary(records);

      expect(summary.deckMedianLatencyMs).toBe(2100);
      expect(summary.buckets.green).toEqual(['q-1']);
      expect(summary.buckets.yellow).toEqual(['q-2', 'q-3']);
      expect(summary.buckets.red).toEqual(['q-4']);
      expect(summary.conceptErrorDensity['tag1']).toBe(0);
      expect(summary.conceptErrorDensity['tag2']).toBe(1);
      expect(summary.conceptErrorDensity['tag3']).toBe(2);
    });

    it('enriches tags from questions metadata if records lack tags', () => {
      const records: CardTelemetryRecord[] = [
        {
          questionId: 'q-meta',
          firstPassCorrect: true,
          totalAttempts: 1,
          totalMisses: 0,
          timeToCorrectMs: 1000,
          conceptTags: []
        }
      ];

      const questions = [
        {
          id: 'q-meta',
          concept_tags: ['inferred-tag']
        }
      ];

      const summary = SessionTelemetryService.generateSessionSummary(records, questions);
      expect(summary.conceptErrorDensity['inferred-tag']).toBe(0);
    });
  });
});

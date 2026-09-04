import { CardTelemetryRecord, MasteryBucket, SessionMasterySummary } from '@quiz-creator/types';

export interface QuestionTagSource {
  id: string;
  concept_tags?: string[] | null;
  discriminatory_keywords?: string[] | null;
}

export class SessionTelemetryService {
  public static readonly HESITATION_THRESHOLD_MULTIPLIER = 1.5;

  /**
   * Calculates rolling median of response latencies with millisecond precision.
   * Returns 0 for empty arrays.
   */
  static calculateMedianLatency(latencies: number[]): number {
    const valid = latencies.filter((l) => typeof l === 'number' && !isNaN(l) && l > 0);
    if (valid.length === 0) return 0;

    const sorted = [...valid].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 1) {
      return sorted[mid];
    } else {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
  }

  /**
   * Determines whether response latency represents cognitive hesitation
   * (> 1.5x deck median latency).
   */
  static isHesitant(
    latencyMs: number,
    deckMedianLatencyMs: number,
    multiplier = SessionTelemetryService.HESITATION_THRESHOLD_MULTIPLIER
  ): boolean {
    if (deckMedianLatencyMs <= 0 || latencyMs <= 0) return false;
    return latencyMs > deckMedianLatencyMs * multiplier;
  }

  /**
   * Categorizes a card into an objective mastery bucket:
   * - Red: >= 2 misses in session, or missed on final sweep attempt / unmastered.
   * - Yellow: First-pass miss resolved on subsequent retry (1 miss and resolved),
   *           OR correct on first pass with response latency > 1.5x deck median.
   * - Green: First-pass correct within normal latency threshold (<= 1.5x median).
   */
  static evaluateCardBucket(
    record: CardTelemetryRecord,
    deckMedianLatencyMs: number
  ): MasteryBucket {
    // Unattempted cards are considered at-risk / unmastered
    if (record.totalAttempts === 0) {
      return 'red';
    }

    // >= 2 misses or unmastered on final attempt (timeToCorrectMs is undefined and totalMisses > 0)
    const isResolved = record.timeToCorrectMs !== undefined;
    if (record.totalMisses >= 2 || !isResolved) {
      return 'red';
    }

    // Resolved with 1 miss (first-pass miss recovered on subsequent retry)
    if (record.totalMisses === 1 && !record.firstPassCorrect) {
      return 'yellow';
    }

    // First-pass correct: check hesitation index against 1.5x deck median
    const firstLatency = (record.latenciesMs && record.latenciesMs[0]) ?? record.timeToCorrectMs ?? 0;
    if (SessionTelemetryService.isHesitant(firstLatency, deckMedianLatencyMs)) {
      return 'yellow';
    }

    return 'green';
  }

  /**
   * Aggregates total misses per concept tag across all cards to identify systemic knowledge gaps.
   */
  static computeConceptErrorDensity(records: CardTelemetryRecord[]): Record<string, number> {
    const density: Record<string, number> = {};

    // Initialize all known concept tags with 0
    for (const record of records) {
      for (const tag of record.conceptTags || []) {
        if (!(tag in density)) {
          density[tag] = 0;
        }
      }
    }

    // Sum misses for each concept tag
    for (const record of records) {
      if (record.totalMisses > 0) {
        for (const tag of record.conceptTags || []) {
          density[tag] = (density[tag] || 0) + record.totalMisses;
        }
      }
    }

    return density;
  }

  /**
   * Generates a complete SessionMasterySummary from card telemetry records.
   */
  static generateSessionSummary(
    records: Record<string, CardTelemetryRecord> | CardTelemetryRecord[],
    questions?: QuestionTagSource[]
  ): SessionMasterySummary {
    const rawList: CardTelemetryRecord[] = Array.isArray(records)
      ? records
      : Object.values(records);

    const questionMap = new Map((questions || []).map((q) => [q.id, q]));
    const recordMap = new Map(rawList.map((r) => [r.questionId, r]));

    // Ensure all questions have a record, even if not explicitly recorded in rawList
    const allRecords: CardTelemetryRecord[] = [];

    if (questions && questions.length > 0) {
      for (const q of questions) {
        const existing = recordMap.get(q.id);
        const resolvedTags = q.concept_tags && q.concept_tags.length > 0
          ? q.concept_tags
          : (q.discriminatory_keywords && q.discriminatory_keywords.length > 0
              ? q.discriminatory_keywords
              : ['general']);

        if (existing) {
          allRecords.push({
            ...existing,
            conceptTags: existing.conceptTags && existing.conceptTags.length > 0
              ? existing.conceptTags
              : resolvedTags
          });
        } else {
          allRecords.push({
            questionId: q.id,
            firstPassCorrect: false,
            totalAttempts: 0,
            totalMisses: 0,
            conceptTags: resolvedTags
          });
        }
      }
    } else {
      allRecords.push(...rawList);
    }

    // Collect all interaction latencies across the deck
    const allLatencies: number[] = [];
    for (const rec of allRecords) {
      if (rec.latenciesMs && rec.latenciesMs.length > 0) {
        allLatencies.push(...rec.latenciesMs.filter((l) => l > 0));
      } else if (rec.timeToCorrectMs && rec.timeToCorrectMs > 0) {
        allLatencies.push(rec.timeToCorrectMs);
      }
    }

    const deckMedianLatencyMs = SessionTelemetryService.calculateMedianLatency(allLatencies);

    const buckets: { red: string[]; yellow: string[]; green: string[] } = {
      red: [],
      yellow: [],
      green: []
    };

    for (const rec of allRecords) {
      const bucket = SessionTelemetryService.evaluateCardBucket(rec, deckMedianLatencyMs);
      buckets[bucket].push(rec.questionId);
    }

    const conceptErrorDensity = SessionTelemetryService.computeConceptErrorDensity(allRecords);

    return {
      deckMedianLatencyMs,
      buckets,
      conceptErrorDensity
    };
  }
}

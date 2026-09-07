import {
  AuthoringPreferenceSignals,
  AuthoringQuestionType,
  UserAuthoringProfile
} from '@quiz-creator/types';

export interface AuthoringQuestionSnapshot {
  questionType: AuthoringQuestionType;
  questionLength: number;
  optionCount: number;
  explanationLength: number;
}

export interface AuthoringEvent {
  action: 'create' | 'edit' | 'delete';
  before?: AuthoringQuestionSnapshot;
  after?: AuthoringQuestionSnapshot;
}

export interface AuthoringPreferenceState extends AuthoringPreferenceSignals {}

const QUESTION_TYPES: AuthoringQuestionType[] = [
  'multiple_choice',
  'typed_answer',
  'identification',
  'true_false',
  'enumeration'
];

const MAX_OBSERVATIONS = 500;
const MAX_METRIC = 10_000;
const MIN_CONFIDENT_OBSERVATIONS = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeMetric(value: number): number {
  return Number.isFinite(value) ? clamp(Math.round(value), 0, MAX_METRIC) : 0;
}

function emptyCounts(): Record<AuthoringQuestionType, number> {
  return {
    multiple_choice: 0,
    typed_answer: 0,
    identification: 0,
    true_false: 0,
    enumeration: 0
  };
}

export class AuthoringPreferenceEngine {
  static readonly MIN_CONFIDENT_OBSERVATIONS = MIN_CONFIDENT_OBSERVATIONS;

  static createState(): AuthoringPreferenceState {
    return {
      version: 1,
      observationCount: 0,
      createCount: 0,
      editCount: 0,
      deleteCount: 0,
      questionTypeCounts: emptyCounts(),
      averageQuestionLength: 0,
      averageOptionCount: 0,
      averageExplanationLength: 0
    };
  }

  static fromSignals(signals: Partial<AuthoringPreferenceSignals> | null | undefined): AuthoringPreferenceState {
    const state = this.createState();
    if (!signals || signals.version !== 1) return state;

    state.observationCount = clamp(Math.round(signals.observationCount || 0), 0, MAX_OBSERVATIONS);
    state.createCount = clamp(Math.round(signals.createCount || 0), 0, MAX_OBSERVATIONS);
    state.editCount = clamp(Math.round(signals.editCount || 0), 0, MAX_OBSERVATIONS);
    state.deleteCount = clamp(Math.round(signals.deleteCount || 0), 0, MAX_OBSERVATIONS);
    state.averageQuestionLength = safeMetric(signals.averageQuestionLength || 0);
    state.averageOptionCount = clamp(Number((signals.averageOptionCount || 0).toFixed(2)), 0, 20);
    state.averageExplanationLength = safeMetric(signals.averageExplanationLength || 0);

    for (const type of QUESTION_TYPES) {
      const count = signals.questionTypeCounts?.[type];
      state.questionTypeCounts[type] = clamp(Math.round(count || 0), 0, MAX_OBSERVATIONS);
    }

    return state;
  }

  static recordEvent(
    current: AuthoringPreferenceState | null | undefined,
    event: AuthoringEvent
  ): AuthoringPreferenceState {
    const state = this.fromSignals(current);
    const next = {
      ...state,
      questionTypeCounts: { ...state.questionTypeCounts }
    };

    if (event.action === 'create') next.createCount = clamp(next.createCount + 1, 0, MAX_OBSERVATIONS);
    if (event.action === 'edit') next.editCount = clamp(next.editCount + 1, 0, MAX_OBSERVATIONS);
    if (event.action === 'delete') next.deleteCount = clamp(next.deleteCount + 1, 0, MAX_OBSERVATIONS);

    if (event.after && (event.action === 'create' || event.action === 'edit')) {
      const previousCount = next.observationCount;
      const nextCount = Math.min(MAX_OBSERVATIONS, previousCount + 1);
      next.observationCount = nextCount;
      next.averageQuestionLength = this.average(previousCount, next.averageQuestionLength, safeMetric(event.after.questionLength));
      next.averageOptionCount = this.average(previousCount, next.averageOptionCount, clamp(Number(event.after.optionCount.toFixed(2)), 0, 20));
      next.averageExplanationLength = this.average(previousCount, next.averageExplanationLength, safeMetric(event.after.explanationLength));

      // Recency decay for question types: when history is substantial, decay older counts so new patterns can emerge
      if (previousCount >= 15) {
        for (const type of QUESTION_TYPES) {
          next.questionTypeCounts[type] = Math.round(next.questionTypeCounts[type] * 0.92);
        }
      }

      next.questionTypeCounts[event.after.questionType] = clamp(
        (next.questionTypeCounts[event.after.questionType] || 0) + 1,
        0,
        MAX_OBSERVATIONS
      );
    }

    return next;
  }

  static toSignals(state: AuthoringPreferenceState | null | undefined): AuthoringPreferenceSignals {
    const s = this.fromSignals(state);
    return {
      ...s,
      averageQuestionLength: Math.round(s.averageQuestionLength),
      averageOptionCount: Math.round(s.averageOptionCount),
      averageExplanationLength: Math.round(s.averageExplanationLength)
    };
  }

  static isConfident(signals: AuthoringPreferenceSignals | null | undefined): boolean {
    return Boolean(signals && signals.version === 1 && signals.observationCount >= MIN_CONFIDENT_OBSERVATIONS);
  }

  static preferredQuestionType(signals: AuthoringPreferenceSignals | null | undefined): AuthoringQuestionType | undefined {
    if (!this.isConfident(signals)) return undefined;
    const entries = QUESTION_TYPES.map((type) => [type, signals!.questionTypeCounts[type] || 0] as const)
      .sort((a, b) => b[1] - a[1]);
    const [preferred, count] = entries[0];
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    return count >= 2 && count / Math.max(1, total) >= 0.5 ? preferred : undefined;
  }

  static applyToProfile(
    profile: UserAuthoringProfile,
    signals: AuthoringPreferenceSignals | null | undefined
  ): UserAuthoringProfile {
    if (!this.isConfident(signals)) return profile;

    const preferredQuestionType = this.preferredQuestionType(signals);
    const preferenceConfidence = Math.min(1, signals!.observationCount / 10);
    const effectiveAverageOptionCount = signals!.averageOptionCount >= 2
      ? signals!.averageOptionCount
      : profile.avgOptionCount;
    const typeDescription = preferredQuestionType
      ? `prefers ${preferredQuestionType.replace('_', ' ')} cards when that mode is available`
      : undefined;
    const optionDescription = effectiveAverageOptionCount && effectiveAverageOptionCount >= 2
      ? `usually authors about ${effectiveAverageOptionCount} visible options`
      : undefined;
    const explanationDescription = signals!.averageExplanationLength >= 40
      ? 'writes detailed explanations'
      : signals!.averageExplanationLength > 0
        ? 'keeps explanations concise'
        : undefined;
    const localDescription = [typeDescription, optionDescription, explanationDescription]
      .filter(Boolean)
      .join(', ');

    return {
      ...profile,
      avgQuestionLength: signals!.averageQuestionLength || profile.avgQuestionLength,
      avgOptionCount: effectiveAverageOptionCount,
      avgExplanationLength: signals!.averageExplanationLength || profile.avgExplanationLength,
      preferredQuestionType,
      preferenceConfidence,
      editCount: signals!.editCount,
      styleSummary: localDescription
        ? `${profile.styleSummary || 'Standard conceptual questions.'} Local authoring pattern: ${localDescription}.`
        : profile.styleSummary
    };
  }

  private static average(previousCount: number, previousAverage: number, nextValue: number): number {
    if (previousCount <= 0) return nextValue;
    // Small sample sizes (<= 5) use standard arithmetic average for initial stability
    if (previousCount <= 5) {
      return Number(((previousAverage * previousCount + nextValue) / (previousCount + 1)).toFixed(2));
    }
    // Sample sizes >= 6 use Exponential Moving Average (EMA) with recency weight alpha >= 0.15
    const alpha = Math.max(0.15, 1 / (previousCount + 1));
    return Number((previousAverage * (1 - alpha) + nextValue * alpha).toFixed(2));
  }
}

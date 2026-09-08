import { getClientUserId } from '../authoringPreferences';

export type ExplanationRating = 'up' | 'down';
export type ExplanationDownvoteReason = 'too_complex' | 'incorrect' | 'too_vague' | 'unhelpful';

export interface ExplanationFeedbackEvent {
  questionId: string;
  rating: ExplanationRating;
  reason?: ExplanationDownvoteReason;
  timestamp: number;
}

export interface ExplanationPreferencesState {
  upvotes: number;
  downvotes: number;
  simplicityBias: number; // positive = prefers simpler analogies
  recentEvents: ExplanationFeedbackEvent[];
}

const STORAGE_PREFIX = 'quiz-creator:explanation-preferences:v1:';

function getStorageKey(guestId?: string | null): string {
  const resolved = guestId || getClientUserId() || 'guest';
  return `${STORAGE_PREFIX}user:${resolved}`;
}

export function getExplanationPreferences(guestId?: string | null): ExplanationPreferencesState {
  if (typeof window === 'undefined') {
    return { upvotes: 0, downvotes: 0, simplicityBias: 0, recentEvents: [] };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(guestId));
    if (!raw) {
      return { upvotes: 0, downvotes: 0, simplicityBias: 0, recentEvents: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      upvotes: Number(parsed.upvotes) || 0,
      downvotes: Number(parsed.downvotes) || 0,
      simplicityBias: Number(parsed.simplicityBias) || 0,
      recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents : [],
    };
  } catch {
    return { upvotes: 0, downvotes: 0, simplicityBias: 0, recentEvents: [] };
  }
}

export function recordExplanationFeedback(
  guestId: string | null | undefined,
  feedback: {
    questionId: string;
    rating: ExplanationRating;
    reason?: ExplanationDownvoteReason;
  }
): ExplanationPreferencesState {
  if (typeof window === 'undefined') {
    return { upvotes: 0, downvotes: 0, simplicityBias: 0, recentEvents: [] };
  }

  try {
    const current = getExplanationPreferences(guestId);
    const isUp = feedback.rating === 'up';

    let simplicityDelta = 0;
    if (!isUp) {
      // Downvoting increases simplicity bias
      simplicityDelta = feedback.reason === 'too_complex' ? 2 : 1;
    } else {
      // Upvoting stabilizes
      simplicityDelta = -0.2;
    }

    const updated: ExplanationPreferencesState = {
      upvotes: current.upvotes + (isUp ? 1 : 0),
      downvotes: current.downvotes + (isUp ? 0 : 1),
      simplicityBias: Math.max(0, Math.min(5, current.simplicityBias + simplicityDelta)),
      recentEvents: [
        {
          questionId: feedback.questionId,
          rating: feedback.rating,
          reason: feedback.reason,
          timestamp: Date.now(),
        },
        ...current.recentEvents.slice(0, 19), // Keep last 20
      ],
    };

    window.localStorage.setItem(getStorageKey(guestId), JSON.stringify(updated));
    return updated;
  } catch {
    return { upvotes: 0, downvotes: 0, simplicityBias: 0, recentEvents: [] };
  }
}

export function getExplanationPromptModifiers(guestId?: string | null): string {
  const prefs = getExplanationPreferences(guestId);
  const modifiers: string[] = [];

  if (prefs.simplicityBias >= 1.5) {
    modifiers.push(
      'Use ultra-simple, 3rd-grade reading level. Compare using tangible household items (e.g. key, lock, mailbox, receipt). Avoid technical protocol terms.'
    );
  } else if (prefs.downvotes > prefs.upvotes && prefs.downvotes >= 2) {
    modifiers.push(
      'Keep wording plain and relatable. Emphasize the single practical difference between the two terms.'
    );
  }

  return modifiers.join(' ');
}

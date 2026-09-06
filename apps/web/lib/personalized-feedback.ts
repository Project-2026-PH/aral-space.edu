import { anonymousLabel } from '@/lib/anonymous';

export interface PersonalizedFeedbackConfig {
  correct?: readonly string[];
  incorrect?: readonly string[];
}

const PERSONALIZED_FEEDBACK_BY_GUEST_LABEL: Readonly<Record<string, PersonalizedFeedbackConfig>> = {
  'Guest-5518f9': {
    correct: [
      'Nice one babyy koo',
      'Galing naman ng babyycakess koo',
      'Eonoh, kuhang-kuha mo talaga... ako'
    ]
  }
};

/**
 * Resolves personalization from the verified server-side anonymous ID.
 * The browser never supplies the identity used for this lookup.
 */
export function getPersonalizedFeedbackForUser(userId: string): PersonalizedFeedbackConfig | null {
  return PERSONALIZED_FEEDBACK_BY_GUEST_LABEL[anonymousLabel(userId)] || null;
}

import { AuthoringPreferenceEngine } from '@quiz-creator/core';
import type { AuthoringEvent, AuthoringQuestionSnapshot } from '@quiz-creator/core';
import type {
  AuthoringPreferenceSignals,
  AuthoringQuestionType
} from '@quiz-creator/types';

const AUTHORING_PREFERENCES_STORAGE_KEY = 'quiz-creator:authoring-preferences:v1';

function readSignals(): AuthoringPreferenceSignals {
  if (typeof window === 'undefined') return AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.createState());

  try {
    const raw = window.localStorage.getItem(AUTHORING_PREFERENCES_STORAGE_KEY);
    if (!raw) return AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.createState());
    return AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.fromSignals(JSON.parse(raw)));
  } catch {
    return AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.createState());
  }
}

export function makeAuthoringQuestionSnapshot(
  questionType: AuthoringQuestionType,
  questionText: string,
  options: string[],
  explanation?: string | null
): AuthoringQuestionSnapshot {
  return {
    questionType,
    questionLength: questionText.trim().split(/\s+/).filter(Boolean).length,
    optionCount: options.filter((option) => option.trim()).length,
    explanationLength: explanation?.trim().length || 0
  };
}

export function loadLocalAuthoringSignals(): AuthoringPreferenceSignals {
  return readSignals();
}

export function recordLocalAuthoringEvent(event: AuthoringEvent): void {
  if (typeof window === 'undefined') return;

  try {
    const current = AuthoringPreferenceEngine.fromSignals(readSignals());
    const next = AuthoringPreferenceEngine.recordEvent(current, event);
    window.localStorage.setItem(
      AUTHORING_PREFERENCES_STORAGE_KEY,
      JSON.stringify(AuthoringPreferenceEngine.toSignals(next))
    );
  } catch {
    // Preference learning is optional and must never block authoring.
  }
}

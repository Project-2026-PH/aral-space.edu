import { AuthoringPreferenceEngine } from '@quiz-creator/core';
import type { AuthoringEvent, AuthoringQuestionSnapshot } from '@quiz-creator/core';
import type {
  AuthoringPreferenceSignals,
  AuthoringQuestionType
} from '@quiz-creator/types';

export interface PreferenceScope {
  userId?: string | null;
  subjectId?: string | null;
}

const LEGACY_STORAGE_KEY = 'quiz-creator:authoring-preferences:v1';
const CLIENT_USER_ID_STORAGE_KEY = 'quizmaster_current_user_id';

export function getClientUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CLIENT_USER_ID_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setClientUserId(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(CLIENT_USER_ID_STORAGE_KEY, userId);
  } catch {
    // Non-blocking
  }
}

export function getAuthoringPreferencesKey(userId?: string | null, subjectId?: string | null): string {
  const resolvedUserId = userId || getClientUserId();
  const userPart = resolvedUserId ? `user:${resolvedUserId}` : 'global';
  const subjectPart = subjectId ? `:subject:${subjectId}` : '';
  return `quiz-creator:authoring-preferences:v2:${userPart}${subjectPart}`;
}

function readSignalsFromKey(key: string, allowLegacyMigration = false): AuthoringPreferenceSignals {
  if (typeof window === 'undefined') return AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.createState());

  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      return AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.fromSignals(JSON.parse(raw)));
    }

    // Attempt legacy migration if this is a global user key without subject partition
    if (allowLegacyMigration) {
      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const migrated = AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.fromSignals(JSON.parse(legacyRaw)));
        window.localStorage.setItem(key, JSON.stringify(migrated));
        return migrated;
      }
    }

    return AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.createState());
  } catch {
    return AuthoringPreferenceEngine.toSignals(AuthoringPreferenceEngine.createState());
  }
}

function writeSignalsToKey(key: string, signals: AuthoringPreferenceSignals): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(signals));
  } catch {
    // Preference storage is optional and non-blocking
  }
}

function recordEventToKey(key: string, event: AuthoringEvent, allowLegacyMigration = false): void {
  if (typeof window === 'undefined') return;
  try {
    const current = AuthoringPreferenceEngine.fromSignals(readSignalsFromKey(key, allowLegacyMigration));
    const next = AuthoringPreferenceEngine.recordEvent(current, event);
    writeSignalsToKey(key, AuthoringPreferenceEngine.toSignals(next));
  } catch {
    // Preference storage is optional and non-blocking
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

export function loadLocalAuthoringSignals(scope?: PreferenceScope): AuthoringPreferenceSignals {
  const userId = scope?.userId || getClientUserId();
  const subjectId = scope?.subjectId || null;

  // 1. If subject specified, check subject-specific partition first
  if (subjectId) {
    const subjectKey = getAuthoringPreferencesKey(userId, subjectId);
    const subjectSignals = readSignalsFromKey(subjectKey, false);
    if (AuthoringPreferenceEngine.isConfident(subjectSignals)) {
      return subjectSignals;
    }
  }

  // 2. Fall back to user's global preferences (with legacy migration support)
  const globalKey = getAuthoringPreferencesKey(userId, null);
  return readSignalsFromKey(globalKey, true);
}

export function recordLocalAuthoringEvent(event: AuthoringEvent, scope?: PreferenceScope): void {
  if (typeof window === 'undefined') return;

  const userId = scope?.userId || getClientUserId();
  const subjectId = scope?.subjectId || null;

  // Always update global user preferences
  const globalKey = getAuthoringPreferencesKey(userId, null);
  recordEventToKey(globalKey, event, true);

  // If subject specified, also update subject-specific partition
  if (subjectId) {
    const subjectKey = getAuthoringPreferencesKey(userId, subjectId);
    recordEventToKey(subjectKey, event, false);
  }
}

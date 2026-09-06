import { describe, expect, it } from 'vitest';
import { AuthoringPreferenceEngine } from '../AuthoringPreferenceEngine';

describe('AuthoringPreferenceEngine', () => {
  it('learns bounded aggregate signals without storing question content', () => {
    let state = AuthoringPreferenceEngine.createState();

    state = AuthoringPreferenceEngine.recordEvent(state, {
      action: 'create',
      after: {
        questionType: 'multiple_choice',
        questionLength: 12,
        optionCount: 4,
        explanationLength: 80
      }
    });
    state = AuthoringPreferenceEngine.recordEvent(state, {
      action: 'edit',
      before: {
        questionType: 'multiple_choice',
        questionLength: 10,
        optionCount: 4,
        explanationLength: 20
      },
      after: {
        questionType: 'typed_answer',
        questionLength: 16,
        optionCount: 0,
        explanationLength: 50
      }
    });
    state = AuthoringPreferenceEngine.recordEvent(state, {
      action: 'create',
      after: {
        questionType: 'typed_answer',
        questionLength: 14,
        optionCount: 0,
        explanationLength: 60
      }
    });

    const signals = AuthoringPreferenceEngine.toSignals(state);
    expect(signals.observationCount).toBe(3);
    expect(signals.editCount).toBe(1);
    expect(signals.questionTypeCounts.typed_answer).toBe(2);
    expect(signals.averageOptionCount).toBe(1);
    expect(AuthoringPreferenceEngine.preferredQuestionType(signals)).toBe('typed_answer');
  });

  it('does not personalize until enough observations exist', () => {
    const profile = {
      targetCount: 10,
      sourceType: 'default' as const,
      styleSummary: 'Standard style.'
    };
    const state = AuthoringPreferenceEngine.recordEvent(AuthoringPreferenceEngine.createState(), {
      action: 'create',
      after: {
        questionType: 'enumeration',
        questionLength: 20,
        optionCount: 3,
        explanationLength: 10
      }
    });

    expect(AuthoringPreferenceEngine.applyToProfile(profile, AuthoringPreferenceEngine.toSignals(state))).toEqual(profile);
  });

  it('adds only aggregate preferences to a confident profile', () => {
    let state = AuthoringPreferenceEngine.createState();
    for (let i = 0; i < 3; i++) {
      state = AuthoringPreferenceEngine.recordEvent(state, {
        action: 'create',
        after: {
          questionType: 'multiple_choice',
          questionLength: 18,
          optionCount: 3,
          explanationLength: 12
        }
      });
    }

    const profile = AuthoringPreferenceEngine.applyToProfile(
      {
        targetCount: 10,
        sourceType: 'manual',
        styleSummary: 'Standard style.'
      },
      AuthoringPreferenceEngine.toSignals(state)
    );

    expect(profile.preferredQuestionType).toBe('multiple_choice');
    expect(profile.avgOptionCount).toBe(3);
    expect(profile.styleSummary).toContain('usually authors about 3 visible options');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as promptBuilder from '../clipboardQuestionPrompt';
import { createClipboardAuthoringCard } from '../clipboardAuthoring';

describe('createClipboardAuthoringCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a single term/definition pair and builds its prompt once', () => {
    const buildPrompt = vi.spyOn(promptBuilder, 'buildClipboardQuestionPrompt');
    buildPrompt.mockReturnValue('What is this called?');

    expect(
      createClipboardAuthoringCard({
        type: 'single_pair',
        term: 'Photosynthesis',
        definition: 'Photosynthesis converts light energy.'
      })
    ).toEqual({
      question: 'What is this called?',
      answer: 'Photosynthesis'
    });
    expect(buildPrompt).toHaveBeenCalledTimes(1);
    expect(buildPrompt).toHaveBeenCalledWith(
      'Photosynthesis converts light energy.',
      'Photosynthesis'
    );
  });

  it('maps a question/answer pair without converting the question', () => {
    const buildPrompt = vi.spyOn(promptBuilder, 'buildClipboardQuestionPrompt');

    expect(
      createClipboardAuthoringCard({
        type: 'question_answer',
        question: 'What is photosynthesis?',
        answer: 'The process plants use to convert light energy.'
      })
    ).toEqual({
      question: 'What is photosynthesis?',
      answer: 'The process plants use to convert light energy.'
    });
    expect(buildPrompt).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { type: 'bulk_terms', items: [] },
    { type: 'question_answers', items: [] },
    { type: 'enumeration_blocks', blocks: [] }
  ] as const)('leaves %s for native or preview handling', (parsed) => {
    expect(createClipboardAuthoringCard(parsed)).toBeNull();
  });
});

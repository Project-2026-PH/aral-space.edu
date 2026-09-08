import { describe, expect, it } from 'vitest';
import {
  groqPrompt,
  hasEvidenceOverlap,
  stemToken,
  validateGroqExplanation,
} from '../ai/serverExplanationEngine';

describe('serverExplanationEngine prompt & grounding', () => {
  const mockQuestion = {
    id: 'q-mitochondria',
    question_text: 'Which organelle produces most of the cell chemical energy?',
    options: ['Ribosome', 'Mitochondria', 'Nucleus', 'Endoplasmic reticulum'],
    correct_answer: 1,
    explanation: 'Mitochondria generate cellular energy through the production of adenosine triphosphate (ATP).',
    distractor_explanations: {
      0: 'Ribosomes are responsible for protein synthesis, not energy production.',
    },
  };

  const resolvedMock = {
    question: mockQuestion,
    questionText: mockQuestion.question_text,
    correctAnswer: 'Mitochondria',
    selectedAnswer: 'Ribosome',
    distractorExplanation: 'Ribosomes are responsible for protein synthesis, not energy production.',
  };

  const wrongEvidenceMock = {
    text: 'Ribosomes are responsible for protein synthesis, not energy production.',
  };

  describe('groqPrompt', () => {
    it('does not contain banned robotic boilerplate phrases in system prompt', () => {
      const prompt = groqPrompt(resolvedMock, wrongEvidenceMock);
      const systemLower = prompt.system.toLowerCase();

      expect(systemLower).not.toContain('the decisive clue is');
      expect(systemLower).not.toContain('the likely confusion is that');
      expect(systemLower).not.toContain('is ruled out here because');
    });

    it('instructs tutor persona and Quizlet-style explanation', () => {
      const prompt = groqPrompt(resolvedMock, wrongEvidenceMock);
      expect(prompt.system).toContain('tutor');
      expect(prompt.system).toContain('Quizlet style');
    });

    it('includes authoritative question, answer, and evidence in user payload', () => {
      const prompt = groqPrompt(resolvedMock, wrongEvidenceMock);
      expect(prompt.user).toContain('Mitochondria');
      expect(prompt.user).toContain('Ribosome');
      expect(prompt.user).toContain('protein synthesis');
    });
  });

  describe('stemToken', () => {
    it('strips common grammatical suffixes', () => {
      expect(stemToken('converting')).toBe('convert');
      expect(stemToken('encryption')).toBe('encrypt');
      expect(stemToken('processes')).toBe('process');
      expect(stemToken('synthesized')).toBe('synthesiz');
    });
  });

  describe('hasEvidenceOverlap', () => {
    const evidence = 'Mitochondria generate cellular energy through the production of ATP.';

    it('matches exact token overlap', () => {
      const output = 'Mitochondria produce cellular fuel for the cell.';
      expect(hasEvidenceOverlap(output, evidence)).toBe(true);
    });

    it('matches inflected words through stem matching', () => {
      const output = 'Mitochondria specialize in the producing of cell energy.';
      expect(hasEvidenceOverlap(output, evidence)).toBe(true);
    });

    it('rejects hallucinated text with zero concept overlap', () => {
      const hallucination = 'Bananas are tropical fruits grown widely in Southeast Asia.';
      expect(hasEvidenceOverlap(hallucination, evidence)).toBe(false);
    });
  });

  describe('validateGroqExplanation', () => {
    it('accepts naturally phrased, tutor-like explanations with correct grounding', () => {
      const naturalExplanation =
        'Mitochondria is the correct answer because it generates the energy a cell needs to function. While Ribosomes are also vital cell structures, they focus on protein synthesis rather than producing energy.';

      const validated = validateGroqExplanation(naturalExplanation, resolvedMock, wrongEvidenceMock);
      expect(validated).toBe(naturalExplanation);
    });

    it('rejects hallucinated output lacking grounding', () => {
      const hallucinated =
        'Photosynthesis occurs inside chloroplasts using chlorophyll to capture sunlight for sugars.';

      const validated = validateGroqExplanation(hallucinated, resolvedMock, wrongEvidenceMock);
      expect(validated).toBeNull();
    });

    it('rejects placeholder outputs', () => {
      const placeholder = 'No trusted explanation for the distinction is available.';
      const validated = validateGroqExplanation(placeholder, resolvedMock, wrongEvidenceMock);
      expect(validated).toBeNull();
    });
  });
});

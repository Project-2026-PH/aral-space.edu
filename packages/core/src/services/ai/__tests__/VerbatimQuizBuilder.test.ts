import { describe, it, expect } from 'vitest';
import { VerbatimQuizBuilder } from '../VerbatimQuizBuilder';
import { VerbatimTermPair } from '@quiz-creator/types';

describe('VerbatimQuizBuilder', () => {
  const sampleDocument = `
    Chapter 1: Cell Biology

    Mitochondria: The powerhouse of the cell responsible for ATP production via oxidative phosphorylation.
    Ribosome: A molecular machine that coordinates protein synthesis by translating messenger RNA.
    Endoplasmic Reticulum: An interconnected network of tubules and flattened sacs involved in protein and lipid synthesis.
    Golgi Apparatus: An organelle that modifies, sorts, and packages macromolecules for cell secretion.
    Lysosome: Membrane-bound digestive vesicles containing acid hydrolases to degrade biopolymers.
  `;

  describe('normalizeForVerification & verifyVerbatimSubstring', () => {
    it('normalizes arbitrary line breaks and multiple spaces', () => {
      const source = 'The powerhouse\n  of the cell responsible   for ATP production.';
      const quote = 'The powerhouse of the cell responsible for ATP production.';
      expect(VerbatimQuizBuilder.verifyVerbatimSubstring(source, quote)).toBe(true);
    });

    it('normalizes typographic quotes and ligatures', () => {
      const source = '“Protein synthesis is fine-tuned by mRNA.”';
      const quote = '"Protein synthesis is ﬁne-tuned by mRNA."'; // ligature fi
      expect(VerbatimQuizBuilder.verifyVerbatimSubstring(source, quote)).toBe(true);
    });

    it('rejects fabricated or paraphrased quotes not present in the text', () => {
      const hallucinated = 'The organelle produces lots of energy for animals.';
      expect(VerbatimQuizBuilder.verifyVerbatimSubstring(sampleDocument, hallucinated)).toBe(false);
    });
  });

  describe('assembleVerbatimQuiz', () => {
    const rawPairs: VerbatimTermPair[] = [
      {
        term: 'Mitochondria',
        verbatim_definition: 'The powerhouse of the cell responsible for ATP production via oxidative phosphorylation.',
        source_page: 1,
        chapter: 'Cell Biology'
      },
      {
        term: 'Ribosome',
        verbatim_definition: 'A molecular machine that coordinates protein synthesis by translating messenger RNA.',
        source_page: 1,
        chapter: 'Cell Biology'
      },
      {
        term: 'Endoplasmic Reticulum',
        verbatim_definition: 'An interconnected network of tubules and flattened sacs involved in protein and lipid synthesis.',
        source_page: 1,
        chapter: 'Cell Biology'
      },
      {
        term: 'Golgi Apparatus',
        verbatim_definition: 'An organelle that modifies, sorts, and packages macromolecules for cell secretion.',
        source_page: 2,
        chapter: 'Cell Biology'
      },
      {
        term: 'Hallucinated Term',
        verbatim_definition: 'A fake definition not anywhere in the sample text.',
        source_page: 2,
        chapter: 'Cell Biology'
      }
    ];

    it('filters out unverified quotes and constructs valid 4-option MCQs', () => {
      const questions = VerbatimQuizBuilder.assembleVerbatimQuiz(rawPairs, sampleDocument, 10);

      // Should have 4 questions (the 5th fake one was discarded)
      expect(questions.length).toBe(4);

      for (const q of questions) {
        // Must have exactly 4 options
        expect(q.options.length).toBe(4);
        expect(new Set(q.options).size).toBe(4); // All distinct options

        // correct_answer points to matching option
        expect(q.correct_answer).toBeGreaterThanOrEqual(0);
        expect(q.correct_answer).toBeLessThanOrEqual(3);

        const correctOpt = q.options[q.correct_answer];
        expect(q.explanation).toContain(correctOpt);

        // All distractors are other definitions from the text
        const otherOptions = q.options.filter((_, idx) => idx !== q.correct_answer);
        for (const distractor of otherOptions) {
          expect(VerbatimQuizBuilder.verifyVerbatimSubstring(sampleDocument, distractor)).toBe(true);
        }
      }
    });

    it('throws error when verified yield is fewer than 4 definitions', () => {
      const sparsePairs: VerbatimTermPair[] = [
        {
          term: 'Mitochondria',
          verbatim_definition: 'The powerhouse of the cell responsible for ATP production via oxidative phosphorylation.',
          source_page: 1
        },
        {
          term: 'Ribosome',
          verbatim_definition: 'A molecular machine that coordinates protein synthesis by translating messenger RNA.',
          source_page: 1
        }
      ];

      expect(() => {
        VerbatimQuizBuilder.assembleVerbatimQuiz(sparsePairs, sampleDocument);
      }).toThrow(/Insufficient verbatim definitions verified in source text \(2\/4 minimum\)/);
    });
  });
});

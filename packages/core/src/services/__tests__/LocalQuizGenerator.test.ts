import { describe, expect, it } from 'vitest';
import { LocalQuizGenerator } from '../LocalQuizGenerator';

const unauthorizedAssociationText = `Unauthorized Association: A major threat to wireless networks. It has two (2) forms: accidental association and malicious association. An attacker performs a malicious association with the help of soft APs instead of corporate APs. The attacker infects the victim's machine and activates soft APs, allowing an unauthorized connection to the enterprise network. An attacker who gains access to the network using unauthorized association may steal passwords, launch attacks on a wired network, or plant Trojans. On the other hand, accidental association involves connecting to the target network’s AP from a neighboring organization’s overlapping network without the victim’s knowledge.`;

describe('LocalQuizGenerator compound concepts', () => {
  it('creates a parent, enumeration, and child questions for explicit forms', () => {
    const questions = LocalQuizGenerator.generate({
      handoutPages: [{ pageNumber: 3, chapterTitle: 'Wireless Networks', text: unauthorizedAssociationText }],
      targetCount: 4
    });

    expect(questions).toHaveLength(4);

    const parent = questions.find((question) =>
      question.options.includes('Unauthorized Association')
    );
    expect(parent).toBeDefined();
    expect(parent?.options[parent.correct_answer]).toBe('Unauthorized Association');
    expect(parent?.question.toLowerCase()).not.toContain('unauthorized association');

    const enumeration = questions.find((question) =>
      question.options.some((option) => option.toLowerCase() === 'accidental association, malicious association')
    );
    expect(enumeration).toBeDefined();
    expect(enumeration?.options[enumeration.correct_answer].toLowerCase()).toBe(
      'accidental association, malicious association'
    );

    for (const childTerm of ['malicious association', 'accidental association']) {
      const child = questions.find((question) =>
        question.options[question.correct_answer]?.toLowerCase() === childTerm
      );
      expect(child).toBeDefined();
      expect(child?.options[child.correct_answer].toLowerCase()).toBe(childTerm);
      expect(child?.question.toLowerCase()).not.toContain(childTerm);
    }
  });

  it('keeps ordinary local question wording unchanged when no compound cue exists', () => {
    const questions = LocalQuizGenerator.generate({
      handoutPages: [{
        pageNumber: 1,
        text: 'Photosynthesis: The process by which plants convert light energy into chemical energy.\nChlorophyll: The pigment that absorbs light.'
      }],
      targetCount: 2
    });

    expect(questions[0].question).toBe('What is Photosynthesis?');
    expect(questions).toHaveLength(2);
  });
});


describe('LocalQuizGenerator naming relations', () => {
  it('extracts the named term after a called relation across soft-wrapped text', () => {
    const text = `Users who regularly connect to multiple\n\nWLANs may connect to the rogue AP. Such APs mounted by attackers are called “honeypot” APs.`;
    const concepts = LocalQuizGenerator.extractConcepts([{ pageNumber: 2, text }]);

    expect(concepts).toHaveLength(1);
    expect(concepts[0]).toMatchObject({
      term: 'honeypot APs',
      evidence: 'naming',
      namingRelation: 'called',
      namingSubject: 'APs mounted by attackers'
    });
  });

  it('generates an answer-safe naming question for the extracted term', () => {
    const text = `Users who regularly connect to multiple\n\nWLANs may connect to the rogue AP. Such APs mounted by attackers are called “honeypot” APs.`;
    const questions = LocalQuizGenerator.generate({
      handoutPages: [{ pageNumber: 2, text }],
      targetCount: 1
    });
    const question = questions[0];

    expect(question.options[question.correct_answer]).toBe('honeypot APs');
    expect(question.question.toLowerCase()).toContain('called');
    expect(question.question.toLowerCase()).not.toContain('honeypot');
  });
});

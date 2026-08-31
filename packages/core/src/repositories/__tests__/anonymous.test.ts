import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryQuizRepository } from '../MemoryQuizRepository';
import { MemorySessionRepository } from '../MemorySessionRepository';

describe('Anonymous User Data Isolation', () => {
  let quizRepo: MemoryQuizRepository;
  let sessionRepo: MemorySessionRepository;

  const userA = 'anon_user_aaa_111';
  const userB = 'anon_user_bbb_222';

  beforeEach(() => {
    quizRepo = new MemoryQuizRepository();
    sessionRepo = new MemorySessionRepository();
  });

  it('allows anonymous user to see default quizzes and their own created quizzes', async () => {
    // Initial: default quiz exists
    const initialQuizzes = await quizRepo.listQuizzes(userA);
    expect(initialQuizzes.length).toBeGreaterThan(0);

    // User A creates a private quiz
    const createdA = await quizRepo.createQuiz({
      title: 'User A Custom Chemistry Quiz',
      questions: [
        {
          question_text: 'What is H2O?',
          options: ['Water', 'Hydrogen', 'Oxygen', 'Helium'],
          correct_answer: 0
        }
      ]
    }, userA);

    // User A should see default + their created quiz
    const userAQuizzes = await quizRepo.listQuizzes(userA);
    expect(userAQuizzes.some(q => q.id === createdA.id)).toBe(true);

    // User B should NOT see User A's custom quiz
    const userBQuizzes = await quizRepo.listQuizzes(userB);
    expect(userBQuizzes.some(q => q.id === createdA.id)).toBe(false);
  });

  it('isolates quiz fetch, update, and delete per anonymous user', async () => {
    const createdA = await quizRepo.createQuiz({
      title: 'Secret Biology Quiz',
      questions: [
        {
          question_text: 'What is ATP?',
          options: ['Energy currency', 'Protein', 'Lipid', 'Carbohydrate'],
          correct_answer: 0
        }
      ]
    }, userA);

    // User A can fetch quiz
    const quizForA = await quizRepo.getQuizById(createdA.id, userA);
    expect(quizForA).not.toBeNull();
    expect(quizForA?.title).toBe('Secret Biology Quiz');

    // User B cannot fetch User A's quiz
    const quizForB = await quizRepo.getQuizById(createdA.id, userB);
    expect(quizForB).toBeNull();

    // User B cannot update User A's quiz
    await expect(quizRepo.updateQuiz(createdA.id, { title: 'Hacked Title' }, userB))
      .rejects.toThrow();

    // User B cannot delete User A's quiz
    const deleteByB = await quizRepo.deleteQuiz(createdA.id, userB);
    expect(deleteByB).toBe(false);

    // User A can delete their own quiz
    const deleteByA = await quizRepo.deleteQuiz(createdA.id, userA);
    expect(deleteByA).toBe(true);
  });

  it('isolates practice sessions and active progress per anonymous user', async () => {
    const quiz = await quizRepo.createQuiz({
      title: 'Shared Test Deck',
      questions: [
        {
          question_text: 'Question 1',
          options: ['A', 'B', 'C', 'D'],
          correct_answer: 0
        }
      ]
    }, userA);

    // User A creates a practice session
    const sessA = await sessionRepo.createSession(quiz.id, 'initial', undefined, userA);
    expect(sessA.user_id).toBe(userA);

    // User A retrieves active session
    const activeA = await sessionRepo.getActiveSession(quiz.id, userA);
    expect(activeA?.id).toBe(sessA.id);

    // User B does not have active session for this quiz yet
    const activeB = await sessionRepo.getActiveSession(quiz.id, userB);
    expect(activeB).toBeNull();

    // User B creates their own session
    const sessB = await sessionRepo.createSession(quiz.id, 'initial', undefined, userB);
    expect(sessB.user_id).toBe(userB);

    // Both have independent sessions
    const listA = await sessionRepo.listSessions(quiz.id, userA);
    const listB = await sessionRepo.listSessions(quiz.id, userB);
    expect(listA.length).toBe(1);
    expect(listB.length).toBe(1);
    expect(listA[0].id).toBe(sessA.id);
    expect(listB[0].id).toBe(sessB.id);
  });
});

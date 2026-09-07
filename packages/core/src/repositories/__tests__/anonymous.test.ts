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

    // Unspecified userId in getActiveSession must NOT return another user's session
    const anonSession = await sessionRepo.getActiveSession(quiz.id, undefined);
    expect(anonSession).toBeNull();
  });

  it('collaborator link supports up to 5 uses and deduplicates by user/device', async () => {
    const subject = await quizRepo.createSubject('Physics 101', '#3b82f6', userA);

    // Create a collaborator link configured for 2 uses
    const link = await quizRepo.createSubjectCollaboratorLink(subject.id, null, userA, 2);
    expect(link.max_uses).toBe(2);
    expect(link.uses_count).toBe(0);

    // User B redeems link (1st unique use)
    const accessB = await quizRepo.redeemSubjectCollaboratorLink(link.token, userB);
    expect(accessB).not.toBeNull();
    expect(accessB?.role).toBe('collaborator');

    // Same user B opens again -> usage count should NOT increase
    const accessBAgain = await quizRepo.redeemSubjectCollaboratorLink(link.token, userB);
    expect(accessBAgain).not.toBeNull();

    // User C redeems link (2nd unique use)
    const userC = 'anon_user_ccc_333';
    const accessC = await quizRepo.redeemSubjectCollaboratorLink(link.token, userC);
    expect(accessC).not.toBeNull();

    // User D attempts to redeem exhausted link -> should be rejected (null)
    const userD = 'anon_user_ddd_444';
    const accessD = await quizRepo.redeemSubjectCollaboratorLink(link.token, userD);
    expect(accessD).toBeNull();

    // Existing redeemed users (B and C) can still access
    const accessBRetried = await quizRepo.redeemSubjectCollaboratorLink(link.token, userB);
    expect(accessBRetried).not.toBeNull();
  });

  it('exposes study sets under shared subject without requiring separate individual share tokens', async () => {
    const subject = await quizRepo.createSubject('Computer Science', '#10b981', userA);
    const config = await quizRepo.getSubjectShareConfig(subject.id, userA);
    expect(config.share_token).toBeTruthy();

    // Create a quiz under this subject without an explicit individual share_token
    const quizInSubject = await quizRepo.createQuiz({
      title: 'Algorithms 101',
      subject_id: subject.id,
      questions: [
        {
          question_text: 'What is quicksort average time complexity?',
          options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(log n)'],
          correct_answer: 0
        }
      ]
    }, userA);

    // Fetch shared subject by share token (public view)
    const publicSubject = await quizRepo.getSubjectByShareToken(config.share_token);
    expect(publicSubject).not.toBeNull();
    expect(publicSubject?.name).toBe('Computer Science');
    expect(publicSubject?.quizzes.length).toBe(1);
    expect(publicSubject?.quizzes[0].id).toBe(quizInSubject.id);
    expect(publicSubject?.quizzes[0].title).toBe('Algorithms 101');
  });
});

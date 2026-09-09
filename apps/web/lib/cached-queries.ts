import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import type { Quiz, Subject, PublicQuizDto, PublicSubjectDto, LibraryData } from '@quiz-creator/types';

/**
 * Cache duration constants
 */
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
} as const;

/**
 * Tag builders for granular cache invalidation across serverless edge instances
 */
export const CacheTags = {
  quiz: (quizId: string) => `quiz-${quizId}`,
  userQuizzes: (userId: string) => `quizzes-user-${userId || 'anon'}`,
  userSubjects: (userId: string) => `subjects-user-${userId || 'anon'}`,
  userQuizDetails: (userId: string) => `quiz-details-user-${userId || 'anon'}`,
  allQuizDetails: 'quiz-details-all',
  allLibraryLists: 'library-lists-all',
  publicQuiz: (shareToken: string) => `public-quiz-${shareToken}`,
  publicSubject: (shareToken: string) => `public-subject-${shareToken}`,
  allPublicQuizzes: 'public-quizzes-all',
  allPublicSubjects: 'public-subjects-all',
} as const;

/**
 * Cached Quiz Retrieval by ID (persisted at edge across serverless lambdas)
 */
export async function getCachedQuiz(
  quizId: string,
  userId?: string
): Promise<(Quiz & { questions: any[] }) | null> {
  const fetcher = unstable_cache(
    async (id: string, uid?: string) => {
      const repo = await getQuizRepository(false);
      const controller = new QuizCrudController(repo);
      return controller.getQuiz(id, uid);
    },
    ['quiz-detail', quizId, userId || 'anon'],
    {
      revalidate: CACHE_TTL.MEDIUM,
      tags: [CacheTags.quiz(quizId), CacheTags.userQuizDetails(userId || 'anon'), CacheTags.allQuizDetails],
    }
  );

  return fetcher(quizId, userId);
}

/**
 * Cached Quizzes and Subjects List
 */
export async function getCachedQuizzesAndSubjects(
  userId?: string
): Promise<LibraryData> {
  const uid = userId || 'anon';
  const fetcher = unstable_cache(
    async (currentUid: string) => {
      const repo = await getQuizRepository(true);
      const controller = new QuizCrudController(repo);
      return controller.listQuizzesAndSubjects(currentUid);
    },
    ['user-quizzes-subjects', uid],
    {
      revalidate: CACHE_TTL.SHORT,
      tags: [CacheTags.userQuizzes(uid), CacheTags.userSubjects(uid), CacheTags.allLibraryLists, CacheTags.allPublicSubjects],
    }
  );

  return fetcher(uid);
}

/**
 * Public share reads must validate revocation, archive state, and expiration on
 * every request. A long-lived Next data cache could outlive share_expires_at.
 */
export async function getCachedPublicQuiz(
  shareToken: string
): Promise<PublicQuizDto | null> {
  const repo = await getQuizRepository(false);
  return repo.getQuizByShareToken(shareToken);
}

/**
 * Public subject reads use the same uncached validity check as public quizzes.
 */
export async function getCachedPublicSubject(
  shareToken: string
): Promise<PublicSubjectDto | null> {
  const repo = await getQuizRepository(false);
  const res = await repo.getSubjectByShareToken(shareToken);
  return (res as PublicSubjectDto | null) ?? null;
}

/**
 * Revalidation helpers for mutations (POST/PATCH/DELETE)
 */
export function revalidateQuizTag(quizId: string, userId?: string, subjectId?: string | null): void {
  try {
    revalidateTag(CacheTags.quiz(quizId));
    revalidateTag(CacheTags.allLibraryLists);
    if (userId) {
      revalidateTag(CacheTags.userQuizzes(userId));
      revalidateTag(CacheTags.userQuizDetails(userId));
    }
    revalidatePath(`/quizzes/${quizId}`);
    revalidatePath(`/review/${quizId}`);
    revalidatePath('/library');
    if (subjectId) {
      revalidatePath(`/subjects/${subjectId}`);
    }
  } catch (err) {
    // Graceful fallback outside Next.js request context (e.g. CLI/tests)
  }
}

export function revalidateUserQuizDetails(userId?: string): void {
  try {
    revalidateTag(CacheTags.userQuizDetails(userId || 'anon'));
  } catch (err) {
    // Graceful fallback
  }
}

export function revalidateAllQuizDetails(): void {
  try {
    revalidateTag(CacheTags.allQuizDetails);
  } catch (err) {
    // Graceful fallback outside Next.js request context.
  }
}

export function revalidateUserLists(userId?: string): void {
  try {
    const uid = userId || 'anon';
    revalidateTag(CacheTags.userQuizzes(uid));
    revalidateTag(CacheTags.userSubjects(uid));
    revalidateTag(CacheTags.allLibraryLists);
    revalidateUserQuizDetails(uid);
    revalidatePath('/library');
  } catch (err) {
    // Graceful fallback
  }
}

export function revalidatePublicQuizCaches(): void {
  try {
    revalidateTag(CacheTags.allPublicQuizzes);
  } catch (err) {
    // Graceful fallback outside Next.js request context.
  }
}

export function revalidatePublicQuizTag(shareToken: string): void {
  try {
    revalidateTag(CacheTags.publicQuiz(shareToken));
  } catch (err) {
    // Graceful fallback
  }
}

export function revalidatePublicSubjectTag(shareToken: string): void {
  try {
    revalidateTag(CacheTags.publicSubject(shareToken));
  } catch (err) {
    // Graceful fallback outside Next.js request context.
  }
}

export function revalidatePublicSubjectCaches(): void {
  try {
    revalidateTag(CacheTags.allPublicSubjects);
  } catch (err) {
    // Graceful fallback outside Next.js request context.
  }
}
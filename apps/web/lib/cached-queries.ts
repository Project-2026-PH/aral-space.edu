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
  publicQuiz: (shareToken: string) => `public-quiz-${shareToken}`,
  publicSubject: (shareToken: string) => `public-subject-${shareToken}`,
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
      tags: [CacheTags.quiz(quizId)],
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
      tags: [CacheTags.userQuizzes(uid), CacheTags.userSubjects(uid)],
    }
  );

  return fetcher(uid);
}

/**
 * Cached Public Quiz by Share Token
 */
export async function getCachedPublicQuiz(
  shareToken: string
): Promise<PublicQuizDto | null> {
  const fetcher = unstable_cache(
    async (token: string) => {
      const repo = await getQuizRepository(true);
      return repo.getQuizByShareToken(token);
    },
    ['public-quiz-token', shareToken],
    {
      revalidate: CACHE_TTL.LONG,
      tags: [CacheTags.publicQuiz(shareToken)],
    }
  );

  return fetcher(shareToken);
}

/**
 * Cached Public Subject by Share Token
 */
export async function getCachedPublicSubject(
  shareToken: string
): Promise<PublicSubjectDto | null> {
  const fetcher = unstable_cache(
    async (token: string): Promise<PublicSubjectDto | null> => {
      const repo = await getQuizRepository(true);
      const res = await repo.getSubjectByShareToken(token);
      return (res as PublicSubjectDto | null) ?? null;
    },
    ['public-subject-token', shareToken],
    {
      revalidate: CACHE_TTL.LONG,
      tags: [CacheTags.publicSubject(shareToken), CacheTags.allPublicSubjects],
    }
  );

  return fetcher(shareToken);
}

/**
 * Revalidation helpers for mutations (POST/PATCH/DELETE)
 */
export function revalidateQuizTag(quizId: string, userId?: string, subjectId?: string | null): void {
  try {
    revalidateTag(CacheTags.quiz(quizId));
    if (userId) {
      revalidateTag(CacheTags.userQuizzes(userId));
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

export function revalidateUserLists(userId?: string): void {
  try {
    const uid = userId || 'anon';
    revalidateTag(CacheTags.userQuizzes(uid));
    revalidateTag(CacheTags.userSubjects(uid));
    revalidatePath('/library');
  } catch (err) {
    // Graceful fallback
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
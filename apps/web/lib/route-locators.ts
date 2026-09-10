import { IQuizRepository } from '@quiz-creator/core';
import { Quiz, Subject } from '@quiz-creator/types';

export type RouteMatch<T> = {
  entity: T;
  id: string;
  isLegacyId: boolean;
};

export async function resolveSubjectRoute(
  repository: IQuizRepository,
  locator: string,
  userId?: string
): Promise<RouteMatch<Subject> | null> {
  const subjects = await repository.listSubjects(userId);
  const bySlug = subjects.find((subject) => subject.slug === locator);
  if (bySlug) return { entity: bySlug, id: bySlug.id, isLegacyId: false };

  const byId = subjects.find((subject) => subject.id === locator);
  if (!byId) return null;
  return { entity: byId, id: byId.id, isLegacyId: Boolean(byId.slug && byId.slug !== locator) };
}

export async function resolveQuizRoute(
  repository: IQuizRepository,
  locator: string,
  userId?: string
): Promise<RouteMatch<Quiz> | null> {
  const quizzes = await repository.listQuizzes(userId);
  const bySlug = quizzes.find((quiz) => quiz.slug === locator);
  if (bySlug) return { entity: bySlug, id: bySlug.id, isLegacyId: false };

  const byId = quizzes.find((quiz) => quiz.id === locator);
  if (!byId) return null;
  return { entity: byId, id: byId.id, isLegacyId: Boolean(byId.slug && byId.slug !== locator) };
}

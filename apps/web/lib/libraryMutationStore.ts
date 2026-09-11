import { useMemo, useSyncExternalStore } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';

export type LibraryMutation =
  | { type: 'quiz-updated'; quiz: Pick<Quiz, 'id'> & Partial<Quiz> }
  | { type: 'quiz-deleted' | 'quiz-archived'; quizId: string }
  | { type: 'subject-updated'; subject: Pick<Subject, 'id'> & Partial<Subject> }
  | { type: 'subject-deleted' | 'subject-archived'; subjectId: string };

export interface LibraryCollections {
  quizzes: Quiz[];
  subjects: Subject[];
  sharedQuizzes: Quiz[];
  sharedSubjects: Subject[];
}

export interface LibraryMutationSnapshot {
  mutations: readonly LibraryMutation[];
}

const EMPTY_SNAPSHOT: LibraryMutationSnapshot = { mutations: [] };
let snapshot: LibraryMutationSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

export function subscribeToLibraryMutations(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLibraryMutationSnapshot() {
  return snapshot;
}

export function getServerLibraryMutationSnapshot() {
  return EMPTY_SNAPSHOT;
}

export function publishLibraryMutation(mutation: LibraryMutation) {
  snapshot = {
    mutations: [...snapshot.mutations, mutation]
  };
  listeners.forEach((listener) => listener());
}

function mergeQuiz(quiz: Quiz, update: Pick<Quiz, 'id'> & Partial<Quiz>): Quiz {
  const merged = { ...quiz, ...update };
  if (update.subject === undefined) {
    merged.subject = quiz.subject;
  }
  return merged;
}

function updateQuizzes(quizzes: Quiz[], update: Pick<Quiz, 'id'> & Partial<Quiz>) {
  return quizzes.map((quiz) => quiz.id === update.id ? mergeQuiz(quiz, update) : quiz);
}

function updateSubjects(subjects: Subject[], update: Pick<Subject, 'id'> & Partial<Subject>) {
  return subjects.map((subject) => subject.id === update.id ? { ...subject, ...update } : subject);
}

function updateQuizSubject(quiz: Quiz, subject: Pick<Subject, 'id'> & Partial<Subject>) {
  if (quiz.subject_id !== subject.id || !quiz.subject) return quiz;
  return { ...quiz, subject: { ...quiz.subject, ...subject } };
}

export function applyLibraryMutations(
  collections: LibraryCollections,
  mutations: readonly LibraryMutation[] = snapshot.mutations
): LibraryCollections {
  let { quizzes, subjects, sharedQuizzes, sharedSubjects } = collections;

  for (const mutation of mutations) {
    switch (mutation.type) {
      case 'quiz-updated':
        quizzes = updateQuizzes(quizzes, mutation.quiz);
        sharedQuizzes = updateQuizzes(sharedQuizzes, mutation.quiz);
        break;
      case 'quiz-deleted':
      case 'quiz-archived':
        quizzes = quizzes.filter((quiz) => quiz.id !== mutation.quizId);
        sharedQuizzes = sharedQuizzes.filter((quiz) => quiz.id !== mutation.quizId);
        break;
      case 'subject-updated':
        subjects = updateSubjects(subjects, mutation.subject);
        sharedSubjects = updateSubjects(sharedSubjects, mutation.subject);
        quizzes = quizzes.map((quiz) => updateQuizSubject(quiz, mutation.subject));
        sharedQuizzes = sharedQuizzes.map((quiz) => updateQuizSubject(quiz, mutation.subject));
        break;
      case 'subject-deleted':
      case 'subject-archived':
        subjects = subjects.filter((subject) => subject.id !== mutation.subjectId);
        sharedSubjects = sharedSubjects.filter((subject) => subject.id !== mutation.subjectId);
        quizzes = quizzes.filter((quiz) => quiz.subject_id !== mutation.subjectId);
        sharedQuizzes = sharedQuizzes.filter((quiz) => quiz.subject_id !== mutation.subjectId);
        break;
    }
  }

  return { quizzes, subjects, sharedQuizzes, sharedSubjects };
}

export function useSynchronizedLibraryCollections(collections: LibraryCollections) {
  const mutationSnapshot = useSyncExternalStore(
    subscribeToLibraryMutations,
    getLibraryMutationSnapshot,
    getServerLibraryMutationSnapshot
  );

  return useMemo(
    () => applyLibraryMutations(collections, mutationSnapshot.mutations),
    [collections.quizzes, collections.subjects, collections.sharedQuizzes, collections.sharedSubjects, mutationSnapshot]
  );
}

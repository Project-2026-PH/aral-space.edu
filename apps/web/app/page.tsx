import React from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { getAnonymousUserId } from '@/lib/anonymous';
import HomeClient from '@/components/home/HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let quizzes: Quiz[] = [];
  let subjects: Subject[] = [];
  let userId = '';

  try {
    userId = await getAnonymousUserId();
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const data = await controller.listQuizzesAndSubjects(userId);
    quizzes = data.quizzes || [];
    subjects = data.subjects || [];
  } catch (err) {
    console.error('Failed to load initial quizzes and subjects on server:', err);
  }

  return (
    <HomeClient
      initialQuizzes={quizzes}
      initialSubjects={subjects}
      viewerId={userId}
    />
  );
}

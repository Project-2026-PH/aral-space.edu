import { Quiz } from './Quiz';
import { Subject } from './Subject';

export interface LibraryData {
  quizzes: Quiz[];
  subjects: Subject[];
  sharedQuizzes?: Quiz[];
  sharedSubjects?: Subject[];
}

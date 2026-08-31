import { QuizQuestion } from './QuizQuestion';
import { QuestionProgress } from './QuestionProgress';

export interface QuizBatchInfo {
  batchNumber: number;
  questions: QuizQuestion[];
  totalQuestions: number;
  lockedQuestions: number;
  isUnlocked: boolean;
  isCompleted: boolean;
}

export interface BatchMasteryStats {
  totalBatches: number;
  completedBatches: number;
  activeBatchIndex: number;
  overallMasteryPercent: number;
}

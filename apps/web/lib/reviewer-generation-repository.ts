import {
  MemoryReviewerGenerationRepository,
  NeonReviewerGenerationRepository,
  type ReviewerGenerationRepository
} from '@quiz-creator/core/repositories';
import { getDatabaseUrl } from './db';

let memoryRepository: ReviewerGenerationRepository | null = null;
let neonRepository: ReviewerGenerationRepository | null = null;

export function getReviewerGenerationRepository(): ReviewerGenerationRepository {
  const databaseUrl = getDatabaseUrl();
  if (databaseUrl) {
    if (!neonRepository) neonRepository = new NeonReviewerGenerationRepository(databaseUrl);
    return neonRepository;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Persistent database configuration is required for reviewer generation');
  }

  if (!memoryRepository) memoryRepository = new MemoryReviewerGenerationRepository();
  return memoryRepository;
}

import { ReviewerGenerationController } from '@quiz-creator/controllers';
import { ReviewerGenerationService } from '@quiz-creator/core/services';
import { getQuizRepository } from './db';
import { getReviewerGenerationRepository } from './reviewer-generation-repository';

export async function processReviewerGenerationJob(jobId: string) {
  const service = new ReviewerGenerationService(
    getReviewerGenerationRepository(),
    await getQuizRepository(false)
  );
  return new ReviewerGenerationController(service).process(jobId);
}

export async function processNextReviewerGenerationJob() {
  const service = new ReviewerGenerationService(
    getReviewerGenerationRepository(),
    await getQuizRepository(false)
  );
  return new ReviewerGenerationController(service).processNext();
}

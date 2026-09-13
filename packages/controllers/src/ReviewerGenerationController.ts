import { ReviewerGenerationService } from '@quiz-creator/core/services';

export class ReviewerGenerationController {
  constructor(private readonly service: ReviewerGenerationService) {}

  process(jobId: string) {
    return this.service.processJob(jobId);
  }

  processNext() {
    return this.service.processNextJob();
  }
}

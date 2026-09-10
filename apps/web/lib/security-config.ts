export const SECURITY_LIMITS = {
  jsonBodyBytes: 512 * 1024,
  sessionBodyBytes: 64 * 1024,
  generationBodyBytes: 4 * 1024 * 1024,
  documentBytes: 25 * 1024 * 1024,
  maxPages: 100,
  maxPageTextLength: 100_000,
  maxTotalTextLength: 2_000_000,
  maxQuestions: 100,
  maxSummaryBytes: 16 * 1024,
  generationTimeoutMs: 90_000,
  documentTimeoutMs: 30_000,
} as const;

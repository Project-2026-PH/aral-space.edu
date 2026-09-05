import { useRef, useState, type MutableRefObject } from 'react';
import { SessionTelemetryService } from '@quiz-creator/core';
import type {
  CardTelemetryRecord,
  QuizQuestion,
  SessionMasterySummary
} from '@quiz-creator/types';

export interface QuizTelemetryController {
  records: Record<string, CardTelemetryRecord>;
  recordsRef: MutableRefObject<Record<string, CardTelemetryRecord>>;
  recordAnswer: (question: QuizQuestion, isCorrect: boolean, latencyMs: number) => CardTelemetryRecord;
  restore: (records: Record<string, CardTelemetryRecord>) => void;
  generateSummary: (questions: QuizQuestion[]) => SessionMasterySummary;
}

export function useQuizTelemetry(): QuizTelemetryController {
  const recordsRef = useRef<Record<string, CardTelemetryRecord>>({});
  const [records, setRecords] = useState<Record<string, CardTelemetryRecord>>({});

  function recordAnswer(
    question: QuizQuestion,
    isCorrect: boolean,
    latencyMs: number
  ): CardTelemetryRecord {
    const questionId = question.id;
    const previous = recordsRef.current[questionId];
    const resolvedTags = question.concept_tags && question.concept_tags.length > 0
      ? question.concept_tags
      : (question.discriminatory_keywords && question.discriminatory_keywords.length > 0
        ? question.discriminatory_keywords
        : ['general']);

    const updated: CardTelemetryRecord = {
      questionId,
      firstPassCorrect: previous ? previous.firstPassCorrect : isCorrect,
      totalAttempts: (previous?.totalAttempts || 0) + 1,
      totalMisses: (previous?.totalMisses || 0) + (isCorrect ? 0 : 1),
      timeToCorrectMs: isCorrect ? latencyMs : previous?.timeToCorrectMs,
      conceptTags: resolvedTags,
      latenciesMs: [...(previous?.latenciesMs || []), latencyMs]
    };
    const next = { ...recordsRef.current, [questionId]: updated };
    recordsRef.current = next;
    setRecords(next);
    return updated;
  }

  function restore(nextRecords: Record<string, CardTelemetryRecord>): void {
    recordsRef.current = nextRecords;
    setRecords(nextRecords);
  }

  function generateSummary(questions: QuizQuestion[]): SessionMasterySummary {
    return SessionTelemetryService.generateSessionSummary(recordsRef.current, questions);
  }

  return { records, recordsRef, recordAnswer, restore, generateSummary };
}

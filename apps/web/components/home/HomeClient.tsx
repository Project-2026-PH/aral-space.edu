'use client';

import React, { useState, useEffect } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import dynamic from 'next/dynamic';
import NewSubjectModal from '@/components/subject/NewSubjectModal';
import SubjectLibrary from '@/components/subject/SubjectLibrary';
import QuizLibrary from '@/components/quiz/QuizLibrary';
import { Sparkles, Plus, Search, LoaderCircle } from 'lucide-react';
import Link from 'next/link';

const GenerateQuizModal = dynamic(() => import('@/components/quiz/GenerateQuizModal'), {
  ssr: false,
});

export interface HomeClientProps {
  initialQuizzes: Quiz[];
  initialSubjects: Subject[];
  viewerId: string;
}

export default function HomeClient({ initialQuizzes, initialSubjects, viewerId }: HomeClientProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [loading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [openingManualQuiz, setOpeningManualQuiz] = useState(false);

  useEffect(() => {
    setQuizzes(initialQuizzes);
  }, [initialQuizzes]);

  useEffect(() => {
    setSubjects(initialSubjects);
  }, [initialSubjects]);

  const filtered = quizzes.filter((q) => {
    return q.title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-8 pb-20">
      {/* Hero Welcome */}
      <div className="flex flex-col justify-between gap-6 rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-8 md:flex-row md:items-center">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            MSRC Spaced Repetition Engine
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Quiz Creation & Mastery Studio
          </h1>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Generate high-yield exam question banks from lecture materials or manually build interactive multiple-choice decks with a continuous 7-item sliding-window mastery queue.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate with AI</span>
          </button>
          <Link
            href="/new?mode=manual"
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              setOpeningManualQuiz(true);
            }}
            aria-busy={openingManualQuiz}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-xs font-bold text-foreground transition-all hover:bg-muted active:scale-95"
          >
            {openingManualQuiz ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Plus aria-hidden="true" className="h-4 w-4" />
            )}
            <span>{openingManualQuiz ? 'Opening editor...' : 'Create Manually'}</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search reviewer library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card py-2.5 pl-10 pr-4 text-xs font-medium text-foreground shadow-2xs focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowSubjectModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Create a Subject</span>
        </button>
      </div>

      <SubjectLibrary
        subjects={subjects}
        quizzes={quizzes}
        viewerId={viewerId}
        loading={loading}
        onSubjectDeleted={(subjectId) => {
          setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
          setQuizzes((current) => current.filter((quiz) => quiz.subject_id !== subjectId));
        }}
        onSubjectUpdated={(subjectId, config) => {
          setSubjects((current) => current.map((subject) => (
            subject.id === subjectId
              ? { ...subject, ...config }
              : subject
          )));
        }}
      />

      <QuizLibrary quizzes={filtered} loading={loading} />

      <NewSubjectModal
        open={showSubjectModal}
        onOpenChange={setShowSubjectModal}
        onCreated={(createdSubject) => {
          setSubjects((current) => [
            createdSubject,
            ...current.filter((subject) => subject.id !== createdSubject.id)
          ]);
          setShowSubjectModal(false);
        }}
      />
      <GenerateQuizModal
        open={showAiModal}
        onOpenChange={setShowAiModal}
      />
    </div>
  );
}

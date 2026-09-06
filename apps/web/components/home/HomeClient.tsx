'use client';

import React, { useState, useEffect } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import dynamic from 'next/dynamic';
import NewSubjectModal from '@/components/subject/NewSubjectModal';
import SubjectLibrary from '@/components/subject/SubjectLibrary';
import QuizLibrary from '@/components/quiz/QuizLibrary';
import { Sparkles, Plus, Search, LoaderCircle, FileText } from 'lucide-react';
import Link from 'next/link';

const GenerateQuizModal = dynamic(() => import('@/components/quiz/GenerateQuizModal'), {
  ssr: false,
});
import FloatingBottomNav from '@/components/navigation/FloatingBottomNav';

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
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
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
    const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = !selectedSubjectId || q.subject_id === selectedSubjectId;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="home-page space-y-8 pb-20">
      {/* Hero Welcome */}
      <div className="home-hero flex flex-col justify-between gap-6 rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-8 md:flex-row md:items-center">
        <div className="space-y-1.5">
          <span className="home-hero-badge inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Master your handouts with us!
          </span>
          <h1 className="home-hero-title text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Reviewer Creation for Students
          </h1>
          <p className="home-hero-description max-w-xl text-xs leading-relaxed text-muted-foreground">
            Generate reviewer question from handouts or manually build interactive multiple-choice decks.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAiModal(true)}
            className="home-primary-action flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
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
            className="home-secondary-action flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-xs font-bold text-foreground transition-all hover:bg-muted active:scale-95"
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
            className="home-search-input w-full rounded-2xl border border-border bg-card py-2.5 pl-10 pr-4 text-xs font-medium text-foreground shadow-2xs focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => setShowSubjectModal(true)}
            className="home-create-subject flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Create a Subject</span>
          </button>
          <Link
            href="/notes"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-xs font-bold text-foreground transition-all hover:bg-muted active:scale-95 sm:w-auto"
          >
            <FileText className="h-4 w-4 text-primary" />
            <span>Create a Note</span>
          </Link>
        </div>
      </div>

      <div id="subjects-section" className="scroll-mt-20">
        <SubjectLibrary
          subjects={subjects}
          quizzes={quizzes}
          viewerId={viewerId}
          loading={loading}
          onSubjectDeleted={(subjectId) => {
            setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
            setQuizzes((current) => current.filter((quiz) => quiz.subject_id !== subjectId));
            setSelectedSubjectId((current) => current === subjectId ? '' : current);
          }}
          onSubjectUpdated={(subjectId, config) => {
            setSubjects((current) => current.map((subject) => (
              subject.id === subjectId
                ? { ...subject, ...config }
                : subject
            )));
          }}
        />
      </div>

      <div id="reviewers-section" className="scroll-mt-20">
        <QuizLibrary
          quizzes={filtered}
          loading={loading}
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          onSubjectChange={setSelectedSubjectId}
        />
      </div>

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

      <FloatingBottomNav
        onOpenAiModal={() => setShowAiModal(true)}
        onOpenSubjectModal={() => setShowSubjectModal(true)}
      />
    </div>
  );
}

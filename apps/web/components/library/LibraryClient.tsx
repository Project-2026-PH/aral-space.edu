'use client';
import React, { useState, useEffect } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import dynamic from 'next/dynamic';
import NewSubjectModal from '@/components/subject/NewSubjectModal';
import SubjectLibrary from '@/components/subject/SubjectLibrary';
import QuizLibrary from '@/components/quiz/QuizLibrary';
import SharedLibrary from '@/components/library/SharedLibrary';
import { Sparkles, Plus, Search, LoaderCircle, FileText } from 'lucide-react';
import Link from 'next/link';
const GenerateQuizModal = dynamic(() => import('@/components/quiz/GenerateQuizModal'), {
  ssr: false,
});
import FloatingBottomNav from '@/components/navigation/FloatingBottomNav';

export interface LibraryClientProps {
  initialQuizzes: Quiz[];
  initialSubjects: Subject[];
  initialSharedQuizzes: Quiz[];
  initialSharedSubjects: Subject[];
  viewerId: string;
}

export default function LibraryClient({ initialQuizzes, initialSubjects, initialSharedQuizzes, initialSharedSubjects, viewerId }: LibraryClientProps) {
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
    <div className="home-page mx-auto max-w-5xl space-y-7 px-4 sm:px-6 lg:px-8 py-6 pb-24 desktop-zoom-133">
      {/* Hero Welcome */}
      <div className="home-hero flex flex-col justify-between gap-4 rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-4 sm:p-6 shadow-brutal md:flex-row md:items-center">
        <div className="space-y-1">
          <span className="home-hero-badge inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-[#fde047] px-2 py-0.5 text-[11px] font-black text-slate-900 shadow-brutal-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Master your handouts with us!
          </span>
          <h1 className="home-hero-title text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Reviewer Creation for Students
          </h1>
          <p className="home-hero-description max-w-md text-xs font-medium leading-normal text-muted-foreground">
            Generate reviewer question from handouts or manually build interactive multiple-choice decks.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAiModal(true)}
            className="home-primary-action flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary px-3.5 py-2 text-xs font-black text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <Sparkles className="h-3.5 w-3.5" />
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
            className="home-secondary-action flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            {openingManualQuiz ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            <span>{openingManualQuiz ? 'Opening editor...' : 'Create Manually'}</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700 dark:text-slate-300" />
          <input
            type="text"
            placeholder="Search reviewer library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="home-search-input w-full rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card py-1.5 pl-9 pr-3 text-xs font-black text-foreground shadow-brutal-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => setShowSubjectModal(true)}
            className="home-create-subject flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-[#86efac] px-3.5 py-1.5 text-xs font-black text-slate-900 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Create a Subject</span>
          </button>
          <Link
            href="/notes"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:w-auto"
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
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
            setQuizzes((current) => current.map((quiz) => (
              quiz.subject_id === subjectId && quiz.subject
                ? { ...quiz, subject: { ...quiz.subject, ...config } }
                : quiz
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

      <SharedLibrary
        subjects={initialSharedSubjects}
        quizzes={initialSharedQuizzes}
        viewerId={viewerId}
      />

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

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import dynamic from 'next/dynamic';
import NewSubjectModal from '@/components/subject/NewSubjectModal';
import SubjectLibrary from '@/components/subject/SubjectLibrary';
import QuizLibrary from '@/components/quiz/QuizLibrary';
import SharedLibrary from '@/components/library/SharedLibrary';
import {
  ArrowRight,
  BookOpen,
  FileText,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
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

type LibraryView = 'overview' | 'subjects' | 'reviewers' | 'shared';

const PREVIEW_LIMIT = 6;

function EmptyLibraryResults({ label, search }: { label: string; search: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-900/40 bg-white p-8 text-center dark:border-white/30 dark:bg-card">
      <Search className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 text-sm font-black text-foreground">
        {search ? `No ${label} match “${search}”` : `No ${label} yet`}
      </p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {search ? 'Try a different title, subject, or keyword.' : 'Create one to keep your study materials organized.'}
      </p>
    </div>
  );
}

export default function LibraryClient({
  initialQuizzes,
  initialSubjects,
  initialSharedQuizzes,
  initialSharedSubjects,
  viewerId,
}: LibraryClientProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [loading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [activeView, setActiveView] = useState<LibraryView>('overview');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [openingManualQuiz, setOpeningManualQuiz] = useState(false);

  useEffect(() => {
    setQuizzes(initialQuizzes);
  }, [initialQuizzes]);

  useEffect(() => {
    setSubjects(initialSubjects);
  }, [initialSubjects]);

  const filteredLibrary = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (value: string | undefined) => !query || Boolean(value?.toLowerCase().includes(query));
    const ownedSubjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
    const sharedSubjectsById = new Map(initialSharedSubjects.map((subject) => [subject.id, subject]));

    const matchesQuiz = (quiz: Quiz, subjectMap: Map<string, Subject>) => {
      const subject = quiz.subject ?? (quiz.subject_id ? subjectMap.get(quiz.subject_id) : undefined);
      return matches(quiz.title) || matches(subject?.name);
    };

    return {
      subjects: subjects.filter((subject) => matches(subject.name)),
      quizzes: quizzes.filter((quiz) => {
        const matchesSubject = !selectedSubjectId || quiz.subject_id === selectedSubjectId;
        return matchesSubject && matchesQuiz(quiz, ownedSubjectsById);
      }),
      sharedSubjects: initialSharedSubjects.filter((subject) => matches(subject.name)),
      sharedQuizzes: initialSharedQuizzes.filter((quiz) => matchesQuiz(quiz, sharedSubjectsById)),
    };
  }, [initialSharedQuizzes, initialSharedSubjects, quizzes, search, selectedSubjectId, subjects]);

  const totalItemCount = subjects.length + quizzes.length + initialSharedSubjects.length + initialSharedQuizzes.length;
  const sharedItemCount = initialSharedSubjects.length + initialSharedQuizzes.length;
  const searchResultCount =
    filteredLibrary.subjects.length
    + filteredLibrary.quizzes.length
    + filteredLibrary.sharedSubjects.length
    + filteredLibrary.sharedQuizzes.length;
  const hasSearch = search.trim().length > 0;

  const viewTabs: Array<{ id: LibraryView; label: string; count: number }> = [
    { id: 'overview', label: 'Overview', count: totalItemCount },
    { id: 'subjects', label: 'Subjects', count: subjects.length },
    { id: 'reviewers', label: 'Reviewers', count: quizzes.length },
    { id: 'shared', label: 'Shared', count: sharedItemCount },
  ];

  const selectView = (view: LibraryView) => {
    setActiveView(view);
  };

  const handleSubjectDeleted = (subjectId: string) => {
    setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
    setQuizzes((current) => current.filter((quiz) => quiz.subject_id !== subjectId));
    setSelectedSubjectId((current) => current === subjectId ? '' : current);
  };

  const handleSubjectUpdated = (subjectId: string, config: Partial<Subject>) => {
    setSubjects((current) => current.map((subject) => (
      subject.id === subjectId ? { ...subject, ...config } : subject
    )));
    setQuizzes((current) => current.map((quiz) => (
      quiz.subject_id === subjectId && quiz.subject
        ? { ...quiz, subject: { ...quiz.subject, ...config } }
        : quiz
    )));
  };

  const handleQuizDeleted = (quizId: string) => {
    setQuizzes((current) => current.filter((quiz) => quiz.id !== quizId));
  };

  const renderOwnedSubjects = (preview = false, heading = 'Your Subjects') => (
    <SubjectLibrary
      subjects={filteredLibrary.subjects}
      quizzes={quizzes}
      viewerId={viewerId}
      loading={loading}
      heading={heading}
      maxItems={preview ? PREVIEW_LIMIT : undefined}
      onViewAll={preview ? () => selectView('subjects') : undefined}
      onSubjectDeleted={handleSubjectDeleted}
      onSubjectUpdated={handleSubjectUpdated}
    />
  );

  const renderOwnedReviewers = (preview = false, heading = 'Your Reviewers') => (
    <QuizLibrary
      quizzes={filteredLibrary.quizzes}
      loading={loading}
      subjects={subjects}
      selectedSubjectId={selectedSubjectId}
      onSubjectChange={setSelectedSubjectId}
      heading={heading}
      maxItems={preview ? PREVIEW_LIMIT : undefined}
      onViewAll={preview ? () => selectView('reviewers') : undefined}
      onQuizDeleted={handleQuizDeleted}
    />
  );

  const renderShared = (preview = false) => (
    <SharedLibrary
      subjects={filteredLibrary.sharedSubjects}
      quizzes={filteredLibrary.sharedQuizzes}
      viewerId={viewerId}
      maxItems={preview ? PREVIEW_LIMIT : undefined}
      onViewAll={preview ? () => selectView('shared') : undefined}
    />
  );

  return (
    <div className="home-page mx-auto max-w-5xl space-y-7 px-4 py-6 pb-24 sm:px-6 lg:px-8 desktop-zoom-133">
      {/* Hero Welcome */}
      <div className="home-hero flex flex-col justify-between gap-4 rounded-3xl border-3 border-slate-900 bg-white p-4 shadow-brutal dark:border-white/40 dark:bg-card sm:p-6 md:flex-row md:items-center">
        <div className="space-y-1">
          <span className="home-hero-badge inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-[#fde047] px-2 py-0.5 text-[11px] font-black text-slate-900 shadow-brutal-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Master your handouts with us!
          </span>
          <h1 className="home-hero-title text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
            Reviewer Creation for Students
          </h1>
          <p className="home-hero-description max-w-md text-xs font-medium leading-normal text-muted-foreground">
            Generate reviewer questions from handouts or manually build interactive multiple-choice decks.
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
                event.defaultPrevented
                || event.button !== 0
                || event.metaKey
                || event.ctrlKey
                || event.shiftKey
                || event.altKey
              ) {
                return;
              }
              setOpeningManualQuiz(true);
            }}
            aria-busy={openingManualQuiz}
            className="home-secondary-action flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-3.5 py-2 text-xs font-black text-slate-900 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:bg-slate-800 dark:text-white"
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

      {/* Library command center */}
      <section className="space-y-3 rounded-2xl border-3 border-slate-900 bg-slate-50 p-3 shadow-brutal dark:border-white/30 dark:bg-card sm:p-4" aria-labelledby="library-navigation-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Library</p>
            <h2 id="library-navigation-heading" className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Find your next review
            </h2>
            <p className="mt-0.5 text-xs font-bold text-muted-foreground">
              Search once, then open only the collection you need.
            </p>
          </div>
          <span className="rounded-lg border-2 border-slate-900 bg-[#fde047] px-3 py-1 text-xs font-black text-slate-900 shadow-brutal-sm">
            {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700 dark:text-slate-300" />
          <label htmlFor="library-search" className="sr-only">Search your library</label>
          <input
            id="library-search"
            type="search"
            placeholder="Search subjects, reviewers, or shared items..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="home-search-input w-full rounded-xl border-2 border-slate-900 bg-white py-2.5 pl-10 pr-10 text-sm font-black text-foreground shadow-brutal-sm outline-none transition-colors focus:border-primary dark:border-white/40 dark:bg-card"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear library search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-1 rounded-xl border-2 border-slate-900 bg-white p-1 dark:border-white/30 dark:bg-slate-900 sm:flex" role="tablist" aria-label="Library sections">
            {viewTabs.map((tab) => {
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectView(tab.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors sm:justify-start ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button
              type="button"
              onClick={() => setShowSubjectModal(true)}
              className="home-create-subject flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-[#86efac] px-3.5 py-2 text-xs font-black text-slate-900 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Create a Subject</span>
            </button>
            <Link
              href="/notes"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-3.5 py-2 text-xs font-black text-slate-900 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:bg-slate-800 dark:text-white sm:w-auto"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>Create a Note</span>
            </Link>
          </div>
        </div>
      </section>

      {activeView === 'overview' && hasSearch && (
        <section className="space-y-4" aria-labelledby="library-search-results-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="library-search-results-heading" className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Search results
              </h2>
              <p className="text-xs font-bold text-muted-foreground">
                {searchResultCount} {searchResultCount === 1 ? 'match' : 'matches'} for “{search}”
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs font-black text-primary underline-offset-2 hover:underline"
            >
              Clear search
            </button>
          </div>

          {searchResultCount === 0 ? (
            <EmptyLibraryResults label="items" search={search} />
          ) : (
            <div className="space-y-7">
              <div id="subjects-section" className="scroll-mt-20">
                {filteredLibrary.subjects.length > 0 && renderOwnedSubjects(true, 'Matching Subjects')}
              </div>
              <div id="reviewers-section" className="scroll-mt-20">
                {filteredLibrary.quizzes.length > 0 && renderOwnedReviewers(true, 'Matching Reviewers')}
              </div>
              <div id="shared-section" className="scroll-mt-20">
                {(filteredLibrary.sharedSubjects.length > 0 || filteredLibrary.sharedQuizzes.length > 0) && renderShared(true)}
              </div>
            </div>
          )}
        </section>
      )}

      {activeView === 'overview' && !hasSearch && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Library shortcuts">
            <button
              type="button"
              onClick={() => selectView('subjects')}
              className="group flex items-center justify-between rounded-2xl border-2 border-slate-900 bg-[#86efac] p-4 text-left text-slate-900 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal"
            >
              <span className="flex items-center gap-3">
                <BookOpen className="h-5 w-5" />
                <span>
                  <span className="block text-sm font-black">Subjects</span>
                  <span className="block text-[11px] font-bold opacity-70">Organize by course</span>
                </span>
              </span>
              <span className="flex items-center gap-1 text-sm font-black">{subjects.length}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </button>
            <button
              type="button"
              onClick={() => selectView('reviewers')}
              className="group flex items-center justify-between rounded-2xl border-2 border-slate-900 bg-[#fde047] p-4 text-left text-slate-900 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal"
            >
              <span className="flex items-center gap-3">
                <Layers className="h-5 w-5" />
                <span>
                  <span className="block text-sm font-black">Reviewers</span>
                  <span className="block text-[11px] font-bold opacity-70">Practice a set</span>
                </span>
              </span>
              <span className="flex items-center gap-1 text-sm font-black">{quizzes.length}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </button>
            <button
              type="button"
              onClick={() => selectView('shared')}
              className="group flex items-center justify-between rounded-2xl border-2 border-slate-900 bg-[#bfdbfe] p-4 text-left text-slate-900 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal"
            >
              <span className="flex items-center gap-3">
                <LockKeyhole className="h-5 w-5" />
                <span>
                  <span className="block text-sm font-black">Shared</span>
                  <span className="block text-[11px] font-bold opacity-70">Open team materials</span>
                </span>
              </span>
              <span className="flex items-center gap-1 text-sm font-black">{sharedItemCount}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </button>
          </section>

          <div id="subjects-section" className="scroll-mt-20">
            {renderOwnedSubjects(true)}
          </div>
          <div id="reviewers-section" className="scroll-mt-20">
            {renderOwnedReviewers(true)}
          </div>
          <div id="shared-section" className="scroll-mt-20">
            {renderShared(true)}
          </div>
        </>
      )}

      {activeView === 'subjects' && (
        <div id="subjects-section" className="scroll-mt-20">
          {filteredLibrary.subjects.length > 0
            ? renderOwnedSubjects(false)
            : <EmptyLibraryResults label="subjects" search={search} />}
        </div>
      )}

      {activeView === 'reviewers' && (
        <div id="reviewers-section" className="scroll-mt-20">
          {renderOwnedReviewers(false)}
        </div>
      )}

      {activeView === 'shared' && (
        <div id="shared-section" className="scroll-mt-20">
          {filteredLibrary.sharedSubjects.length > 0 || filteredLibrary.sharedQuizzes.length > 0
            ? renderShared(false)
            : <EmptyLibraryResults label="shared items" search={search} />}
        </div>
      )}

      <NewSubjectModal
        open={showSubjectModal}
        onOpenChange={setShowSubjectModal}
        onCreated={(createdSubject) => {
          setSubjects((current) => [
            createdSubject,
            ...current.filter((subject) => subject.id !== createdSubject.id),
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
        onLibrarySectionSelect={(section) => setActiveView(section)}
        activeSection={activeView === 'reviewers' ? 'reviewers' : activeView === 'subjects' ? 'subjects' : undefined}
      />
    </div>
  );
}

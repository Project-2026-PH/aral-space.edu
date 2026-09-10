'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  FilePlus2,
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

function normalizeTerm(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

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
  const [sharedQuizzes, setSharedQuizzes] = useState<Quiz[]>(initialSharedQuizzes);
  const [sharedSubjects, setSharedSubjects] = useState<Subject[]>(initialSharedSubjects);
  const [loading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [activeView, setActiveView] = useState<LibraryView>('overview');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [openingManualQuiz, setOpeningManualQuiz] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showQuickCreate) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!quickCreateRef.current?.contains(event.target as Node)) {
        setShowQuickCreate(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowQuickCreate(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showQuickCreate]);

  useEffect(() => {
    setQuizzes(initialQuizzes);
  }, [initialQuizzes]);

  useEffect(() => {
    setSubjects(initialSubjects);
  }, [initialSubjects]);

  useEffect(() => {
    setSharedQuizzes(initialSharedQuizzes);
  }, [initialSharedQuizzes]);

  useEffect(() => {
    setSharedSubjects(initialSharedSubjects);
  }, [initialSharedSubjects]);

  const filteredLibrary = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (value: string | undefined) => !query || Boolean(value?.toLowerCase().includes(query));
    const ownedSubjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
    const sharedSubjectsById = new Map(sharedSubjects.map((subject) => [subject.id, subject]));

    const matchesQuiz = (quiz: Quiz, subjectMap: Map<string, Subject>) => {
      const subject = quiz.subject ?? (quiz.subject_id ? subjectMap.get(quiz.subject_id) : undefined);
      return matches(quiz.title) || matches(subject?.name);
    };

    const reviewerCandidates = quizzes.filter((quiz) => {
      const matchesSubject = !selectedSubjectId || quiz.subject_id === selectedSubjectId;
      return matchesSubject && matchesQuiz(quiz, ownedSubjectsById);
    });

    return {
      subjects: subjects.filter((subject) => matches(subject.name)),
      reviewerCandidates,
      quizzes: reviewerCandidates.filter((quiz) => (
        !selectedTerm || normalizeTerm(quiz.term) === normalizeTerm(selectedTerm)
      )),
      sharedSubjects: sharedSubjects.filter((subject) => matches(subject.name)),
      sharedQuizzes: sharedQuizzes.filter((quiz) => matchesQuiz(quiz, sharedSubjectsById)),
    };
  }, [
    sharedQuizzes,
    sharedSubjects,
    quizzes,
    search,
    selectedSubjectId,
    selectedTerm,
    subjects,
  ]);

  const totalItemCount = subjects.length + quizzes.length + sharedSubjects.length + sharedQuizzes.length;
  const sharedItemCount = sharedSubjects.length + sharedQuizzes.length;
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

  const handleSubjectArchived = async (subjectId: string) => {
    try {
      const res = await fetch(`/api/subjects/${subjectId}/archive`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to archive subject');
      setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
      setQuizzes((current) => current.filter((quiz) => quiz.subject_id !== subjectId));
      setSharedSubjects((current) => current.filter((subject) => subject.id !== subjectId));
      setSharedQuizzes((current) => current.filter((quiz) => quiz.subject_id !== subjectId));
      setSelectedSubjectId((current) => current === subjectId ? '' : current);
    } catch (err) {
      console.error('Failed to archive subject:', err);
    }
  };

  const handleQuizDeleted = (quizId: string) => {
    setQuizzes((current) => current.filter((quiz) => quiz.id !== quizId));
  };

  const handleQuizArchived = (quizId: string) => {
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
      onSubjectArchived={handleSubjectArchived}
      onSubjectUpdated={handleSubjectUpdated}
    />
  );

  const renderOwnedReviewers = (preview = false, heading = 'Your Reviewers') => (
    <QuizLibrary
      quizzes={filteredLibrary.reviewerCandidates}
      loading={loading}
      subjects={subjects}
      selectedSubjectId={selectedSubjectId}
      onSubjectChange={setSelectedSubjectId}
      selectedTerm={selectedTerm}
      onTermChange={setSelectedTerm}
      heading={heading}
      maxItems={preview ? PREVIEW_LIMIT : undefined}
      onViewAll={preview ? () => selectView('reviewers') : undefined}
      onQuizDeleted={handleQuizDeleted}
      onQuizArchived={handleQuizArchived}
    />
  );

  const renderShared = (preview = false) => (
    <SharedLibrary
      subjects={filteredLibrary.sharedSubjects}
      quizzes={filteredLibrary.sharedQuizzes}
      viewerId={viewerId}
      maxItems={preview ? PREVIEW_LIMIT : undefined}
      onViewAll={preview ? () => selectView('shared') : undefined}
      onSubjectArchived={handleSubjectArchived}
    />
  );

  return (
    <div className="home-page mx-auto max-w-5xl space-y-7 px-4 py-6 pb-24 sm:px-6 lg:px-8 desktop-zoom-133">
      {/* Library command center */}
      <section
        className="home-hero space-y-4 rounded-3xl border-3 border-slate-900 bg-slate-50 p-4 shadow-brutal dark:border-white/30 dark:bg-card sm:p-6"
        aria-labelledby="library-navigation-heading"
      >
        <div className="space-y-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="home-hero-badge inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-[#fde047] px-2 py-0.5 text-[11px] font-black text-slate-900 shadow-brutal-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Master your handouts with us!
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                Library
              </span>
            </div>
            <span className="shrink-0 rounded-lg border-2 border-slate-900 bg-[#fde047] px-3 py-1 text-xs font-black text-slate-900 shadow-brutal-sm">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <h1 className="home-hero-title text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
            Reviewer Creation for Students
          </h1>
          <div>
            <p className="mt-0.5 text-xs font-bold text-muted-foreground">
              Generate reviewer questions from handouts or manually build interactive multiple-choice decks.
            </p>
          </div>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border-2 border-slate-900 bg-white p-1 dark:border-white/30 dark:bg-slate-900 scrollbar-none" role="tablist" aria-label="Library sections">
            {viewTabs.map((tab) => {
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectView(tab.id)}
                  className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-colors ${
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

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="home-primary-action flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary hover:bg-[#1d4ed8] px-3.5 py-2 text-xs font-black text-white shadow-brutal-sm transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Generate with AI</span>
            </button>
            <div ref={quickCreateRef} className="relative">
              <button
                type="button"
                onClick={() => setShowQuickCreate((current) => !current)}
                aria-label="More creation options"
                aria-haspopup="menu"
                aria-expanded={showQuickCreate}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 bg-primary hover:bg-[#1d4ed8] text-white shadow-brutal-sm transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer"
              >
                <Plus
                  aria-hidden="true"
                  className={`h-5 w-5 transition-transform duration-200 ${showQuickCreate ? 'rotate-45' : ''}`}
                />
              </button>

              {showQuickCreate && (
                <div
                  role="menu"
                  aria-label="Creation options"
                  className="absolute right-0 top-full z-20 mt-3 min-w-[220px] rounded-2xl border border-border/80 bg-card p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="space-y-1">
                    <Link
                      href="/new?mode=manual"
                      role="menuitem"
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
                        setShowQuickCreate(false);
                        setOpeningManualQuiz(true);
                      }}
                      aria-busy={openingManualQuiz}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground">
                        {openingManualQuiz ? (
                          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <FilePlus2 aria-hidden="true" className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold">Create Manually</p>
                        <p className="text-[10px] text-muted-foreground">Write question decks</p>
                      </div>
                    </Link>

                    <Link
                      href="/notes"
                      role="menuitem"
                      onClick={() => setShowQuickCreate(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <FileText aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold">Create Notes</p>
                        <p className="text-[10px] text-muted-foreground">Capture formatted study notes</p>
                      </div>
                    </Link>

                    {/* <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowQuickCreate(false);
                        setShowSubjectModal(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <BookOpen aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold">Create Subject</p>
                        <p className="text-[10px] text-muted-foreground">Organize your topics</p>
                      </div>
                    </button> */}
                  </div>
                </div>
              )}
            </div>
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
        subjects={subjects}
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

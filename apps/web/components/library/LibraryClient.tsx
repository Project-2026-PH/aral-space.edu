'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Quiz, Subject } from '@quiz-creator/types';
import dynamic from 'next/dynamic';
import NewSubjectModal from '@/components/subject/NewSubjectModal';
import SubjectLibrary from '@/components/subject/SubjectLibrary';
import QuizLibrary from '@/components/quiz/QuizLibrary';
import SharedLibrary from '@/components/library/SharedLibrary';
import {
  ArrowRight,
  Atom,
  BookOpen,
  FileText,
  FilePlus2,
  FlaskConical,
  GraduationCap,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Rocket,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
const GenerateQuizModal = dynamic(() => import('@/components/quiz/GenerateQuizModal'), {
  ssr: false,
});
import FloatingBottomNav from '@/components/navigation/FloatingBottomNav';
import KoleAgent from '@/components/library/KoleAgent';
import LibrarySidebar from '@/components/library/LibrarySidebar';
import { useSynchronizedLibraryCollections, publishLibraryMutation } from '@/lib/libraryMutationStore';

export interface LibraryClientProps {
  initialQuizzes: Quiz[];
  initialSubjects: Subject[];
  initialSharedQuizzes: Quiz[];
  initialSharedSubjects: Subject[];
  viewerId: string;
}

type LibraryView = 'overview' | 'subjects' | 'reviewers' | 'shared';

const PREVIEW_LIMIT = 6;

const LIBRARY_TIPS = [
  'Did you know? Paste a whole paragraph and Aral Space can automatically detect the questions and answers.',
  'Tip: Switch a question to True or False and Quiz Creator rewrites it into a natural exam-style statement.',
  'Tip: Use Draw mode during flashcard review to annotate cards with a pen or highlighter.',
  'Tip: Press H during flashcard review to reveal a hint without flipping the card.',
] as const;

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
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [activeView, setActiveView] = useState<LibraryView>('overview');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [openingManualQuiz, setOpeningManualQuiz] = useState(false);
  const [quickCreatePosition, setQuickCreatePosition] = useState<{ top: number; left: number } | null>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const quickCreateButtonRef = useRef<HTMLButtonElement>(null);
  const quickCreateMenuRef = useRef<HTMLDivElement>(null);
  const synchronizedLibrary = useSynchronizedLibraryCollections({
    quizzes,
    subjects,
    sharedQuizzes,
    sharedSubjects,
  });

  useEffect(() => {
    const tipTimer = window.setInterval(() => {
      setActiveTipIndex((currentIndex) => (currentIndex + 1) % LIBRARY_TIPS.length);
    }, 10_000);

    return () => window.clearInterval(tipTimer);
  }, []);

  useEffect(() => {
    if (!showQuickCreate) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        !quickCreateRef.current?.contains(event.target as Node)
        && !quickCreateMenuRef.current?.contains(event.target as Node)
      ) {
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
    if (!showQuickCreate) {
      setQuickCreatePosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = quickCreateButtonRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 220;
      const edgePadding = 16;
      const triggerRight = rect.right;
      const triggerBottom = rect.bottom;
      const left = Math.min(
        Math.max(edgePadding, triggerRight - menuWidth),
        Math.max(edgePadding, window.innerWidth - menuWidth - edgePadding),
      );
      const top = triggerBottom + 12;

      setQuickCreatePosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
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
    const ownedSubjectsById = new Map(synchronizedLibrary.subjects.map((subject) => [subject.id, subject]));
    const sharedSubjectsById = new Map(synchronizedLibrary.sharedSubjects.map((subject) => [subject.id, subject]));

    const matchesQuiz = (quiz: Quiz, subjectMap: Map<string, Subject>) => {
      const subject = quiz.subject ?? (quiz.subject_id ? subjectMap.get(quiz.subject_id) : undefined);
      return matches(quiz.title) || matches(subject?.name);
    };

    const reviewerCandidates = synchronizedLibrary.quizzes.filter((quiz) => {
      const matchesSubject = !selectedSubjectId || quiz.subject_id === selectedSubjectId;
      return matchesSubject && matchesQuiz(quiz, ownedSubjectsById);
    });

    return {
      subjects: synchronizedLibrary.subjects.filter((subject) => matches(subject.name)),
      reviewerCandidates,
      quizzes: reviewerCandidates.filter((quiz) => (
        !selectedTerm || normalizeTerm(quiz.term) === normalizeTerm(selectedTerm)
      )),
      sharedSubjects: synchronizedLibrary.sharedSubjects.filter((subject) => matches(subject.name)),
      sharedQuizzes: synchronizedLibrary.sharedQuizzes.filter((quiz) => matchesQuiz(quiz, sharedSubjectsById)),
    };
  }, [
    synchronizedLibrary,
    search,
    selectedSubjectId,
    selectedTerm,
  ]);

  const totalItemCount = synchronizedLibrary.subjects.length + synchronizedLibrary.quizzes.length + synchronizedLibrary.sharedSubjects.length + synchronizedLibrary.sharedQuizzes.length;
  const sharedItemCount = synchronizedLibrary.sharedSubjects.length + synchronizedLibrary.sharedQuizzes.length;
  const searchResultCount =
    filteredLibrary.subjects.length
    + filteredLibrary.quizzes.length
    + filteredLibrary.sharedSubjects.length
    + filteredLibrary.sharedQuizzes.length;
  const hasSearch = search.trim().length > 0;

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
      publishLibraryMutation({ type: 'subject-archived', subjectId });
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
      quizzes={synchronizedLibrary.quizzes}
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
      subjects={synchronizedLibrary.subjects}
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
    <div className="lg:flex lg:min-h-[calc(100vh-4rem)]">
      <LibrarySidebar
        activeView={activeView}
        onSelect={selectView}
        totalCount={totalItemCount}
        setCount={synchronizedLibrary.quizzes.length}
        subjectCount={synchronizedLibrary.subjects.length}
        sharedCount={sharedItemCount}
      />
      <div className="min-w-0 flex-1 pl-14 lg:pl-0">
        <div className="home-page mx-auto max-w-5xl space-y-7 px-4 py-6 pb-24 sm:px-6 lg:px-8 desktop-zoom-133">
      {/* Library command center */}
      <section
        className="home-hero relative isolate z-30 space-y-4 overflow-visible rounded-3xl border-3 border-slate-900 bg-slate-50 p-4 shadow-brutal transition-colors duration-500 dark:border-white/30 dark:bg-card sm:p-6"
        aria-labelledby="library-navigation-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden text-sky-600 opacity-[0.07] transition-colors duration-500 dark:text-violet-300 dark:opacity-[0.14]"
          aria-hidden="true"
        >
          <Rocket
            className="animate-doodle-float absolute -left-4 top-8 h-24 w-24"
            style={{ animationDelay: '-1.2s' }}
          />
          <GraduationCap
            className="animate-doodle-float absolute left-[38%] -top-5 h-16 w-16"
            style={{ animationDelay: '-3.1s' }}
          />
          <Atom
            className="animate-doodle-float absolute right-[18%] top-12 h-20 w-20"
            style={{ animationDelay: '-0.6s' }}
          />
        </div>

        <div className="relative z-10 space-y-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="home-hero-badge inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-[#fde047] px-2 py-0.5 text-[11px] font-black text-slate-900 shadow-brutal-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Master your handouts with us!
              </span>
            </div>
            <span className="shrink-0 rounded-lg border-2 border-slate-900 bg-[#fde047] px-3 py-1 text-xs font-black text-slate-900 shadow-brutal-sm">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <h1 className="home-hero-title text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
            Reviewer Creation for Students
          </h1>
          <div className="min-h-[2.15rem] overflow-hidden">
            <p
              key={activeTipIndex}
              aria-live="polite"
              className="library-tip-slide-in mt-0.5 text-xs font-bold text-muted-foreground"
            >
              {LIBRARY_TIPS[activeTipIndex]}
            </p>
          </div>
        </div>

        <div className="relative z-10">
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

        <div className="relative z-10 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="home-primary-action flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary hover:bg-[#1d4ed8] px-3.5 py-2 text-xs font-black text-white shadow-brutal-sm transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Generate with AI</span>
            </button>

            {/* Drop Down button for Creating sets manually and for notes. */}
            <div ref={quickCreateRef} className="relative">
              <button
                ref={quickCreateButtonRef}
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

              {showQuickCreate && quickCreatePosition && typeof document !== 'undefined' && createPortal(
                <div
                  ref={quickCreateMenuRef}
                  role="menu"
                  aria-label="Creation options"
                  style={{
                    position: 'fixed',
                    zIndex: 10000,
                    top: quickCreatePosition.top,
                    left: quickCreatePosition.left,
                  }}
                  className="library-create-menu fixed z-[10000] min-w-[220px] rounded-2xl border border-border/80 bg-card p-2 shadow-2xl backdrop-blur-xl"
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
                      className="relative z-[10000] flex w-full items-center gap-2.5 rounded-xl bg-card px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
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
                </div>,
                document.body
              )}
            </div>
        </div>
      </section>

      <KoleAgent
        quizzes={synchronizedLibrary.quizzes}
        sharedQuizzes={synchronizedLibrary.sharedQuizzes}
        subjects={synchronizedLibrary.subjects}
        sharedSubjects={synchronizedLibrary.sharedSubjects}
        viewerId={viewerId}
      />

      <div key={activeView} className="space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
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
      </div>

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
        subjects={synchronizedLibrary.subjects}
      />
      <FloatingBottomNav
        onOpenAiModal={() => setShowAiModal(true)}
        onOpenSubjectModal={() => setShowSubjectModal(true)}
        onLibrarySectionSelect={(section) => setActiveView(section)}
        activeSection={activeView === 'reviewers' ? 'reviewers' : activeView === 'subjects' ? 'subjects' : undefined}
      />
        </div>
      </div>
    </div>
  );
}

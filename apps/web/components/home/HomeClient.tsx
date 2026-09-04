'use client';

import React, { useState, useEffect } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import dynamic from 'next/dynamic';
import NewSubjectModal from '@/components/subject/NewSubjectModal';
import SubjectLibrary from '@/components/subject/SubjectLibrary';
import { Sparkles, Plus, BookOpen, Play, Search } from 'lucide-react';
import Link from 'next/link';

const GenerateQuizModal = dynamic(() => import('@/components/quiz/GenerateQuizModal'), {
  ssr: false,
});

export interface HomeClientProps {
  initialQuizzes: Quiz[];
  initialSubjects: Subject[];
}

export default function HomeClient({ initialQuizzes, initialSubjects }: HomeClientProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [search, setSearch] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

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
            Generate high-yield exam question banks from lecture materials or manually build interactive multiple-choice decks with systematic 5-question spaced-repetition loops.
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
            className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-xs font-bold text-foreground transition-all hover:bg-muted active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Manual Builder</span>
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

      <SubjectLibrary subjects={subjects} quizzes={quizzes} loading={false} />

      {/* Quizzes Grid */}
      {filtered.length === 0 ? (
        <div className="space-y-4 rounded-3xl border border-dashed border-border p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">No quizzes found</p>
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">
            Click &quot;Generate with AI&quot; or &quot;Manual Builder&quot; to author your first question bank.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((quiz) => (
            <div
              key={quiz.id}
              className="group flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">Reviewer</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {quiz.question_count} Qs
                  </span>
                </div>

                <Link href={`/quizzes/${quiz.id}`}>
                  <h3 className="line-clamp-2 text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                    {quiz.title}
                  </h3>
                </Link>

                {quiz.handout_name && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    Source: {quiz.handout_name}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
                <Link
                  href={`/quizzes/${quiz.id}`}
                  className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Manage Bank
                </Link>
                <Link
                  href={`/practice/${quiz.id}`}
                  className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary shadow-2xs transition-all hover:bg-primary hover:text-white active:scale-95"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>Practice</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

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

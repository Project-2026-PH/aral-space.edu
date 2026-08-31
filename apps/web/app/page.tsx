'use client';

import React, { useState, useEffect } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import GenerateQuizModal from '@/components/quiz/GenerateQuizModal';
import { Sparkles, Plus, BookOpen, Layers, Play, Clock, Search, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/quizzes');
        if (res.ok) {
          const data = await res.json();
          setQuizzes(data.quizzes || []);
          setSubjects(data.subjects || []);
        }
      } catch (err) {
        console.error('Failed to load quizzes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = quizzes.filter((q) => {
    const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubjectId === 'all' || q.subject_id === selectedSubjectId;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="space-y-8 pb-20">
      {/* Hero Welcome */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            MSRC Spaced Repetition Engine
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Quiz Creation & Mastery Studio
          </h1>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            Generate high-yield exam question banks from lecture materials or manually build interactive multiple-choice decks with systematic 5-question spaced-repetition loops.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate with AI</span>
          </button>
          <Link
            href="/new"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Manual Builder</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search quiz library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none shadow-2xs"
          />
        </div>

        {subjects.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedSubjectId('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                selectedSubjectId === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSubjectId(s.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                  selectedSubjectId === s.id
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quizzes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-3xl bg-muted/40 border border-border/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center space-y-4">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">No quizzes found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Click &quot;Generate with AI&quot; or &quot;Manual Builder&quot; to author your first question bank.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((quiz) => (
            <div
              key={quiz.id}
              className="group rounded-3xl border border-border/80 bg-card p-5 shadow-2xs hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  {quiz.subject ? (
                    <span className="flex items-center gap-1.5 font-bold text-foreground">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: quiz.subject.color }}
                      />
                      {quiz.subject.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">General</span>
                  )}
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {quiz.question_count} Qs
                  </span>
                </div>

                <Link href={`/quizzes/${quiz.id}`}>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {quiz.title}
                  </h3>
                </Link>

                {quiz.handout_name && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    Source: {quiz.handout_name}
                  </p>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-border/40 flex items-center justify-between">
                <Link
                  href={`/quizzes/${quiz.id}`}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Manage Bank
                </Link>
                <Link
                  href={`/practice/${quiz.id}`}
                  className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all active:scale-95 shadow-2xs"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>Practice</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <GenerateQuizModal
        open={showAiModal}
        onOpenChange={setShowAiModal}
        subjects={subjects}
      />
    </div>
  );
}

'use client';

import React from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import { Eye, LockKeyhole } from 'lucide-react';
import SubjectLibrary from '@/components/subject/SubjectLibrary';
import QuizLibrary from '@/components/quiz/QuizLibrary';

interface SharedLibraryProps {
  subjects: Subject[];
  quizzes: Quiz[];
  viewerId: string;
}

export default function SharedLibrary({ subjects, quizzes, viewerId }: SharedLibraryProps) {
  if (subjects.length === 0 && quizzes.length === 0) return null;

  return (
    <section className="space-y-5" aria-labelledby="shared-library-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-3 border-slate-900/20 dark:border-white/20 pt-6">
        <div>
          <h2 id="shared-library-heading" className="flex items-center gap-2 text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            <LockKeyhole aria-hidden="true" className="h-5 w-5 text-primary" />
            Shared Library
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Eye aria-hidden="true" className="h-3.5 w-3.5" />
            Shared subjects are read-only; shared reviewers can be edited.
          </p>
        </div>
        <span className="rounded-lg border-2 border-slate-900 bg-[#bfdbfe] px-3 py-1 text-xs font-black text-slate-900 shadow-brutal-sm">
          {subjects.length + quizzes.length} shared {subjects.length + quizzes.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <SubjectLibrary
        subjects={subjects}
        quizzes={quizzes}
        viewerId={viewerId}
        readOnly
        heading="Shared Subjects"
      />
      <QuizLibrary
        quizzes={quizzes}
        loading={false}
        subjects={subjects}
        heading="Shared Reviewers"
      />
    </section>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import { BookOpen, ExternalLink, Eye, Layers, Link2, Lock, Share2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ShareSubjectModal from './ShareSubjectModal';
import DeleteSubjectModal from './DeleteSubjectModal';
import Skeleton from '@/components/ui/Skeleton';

interface SubjectLibraryProps {
  subjects: Subject[];
  quizzes: Quiz[];
  viewerId: string;
  loading?: boolean;
  readOnly?: boolean;
  heading?: string;
  onSubjectDeleted?: (subjectId: string) => void;
  onSubjectUpdated?: (subjectId: string, config: { share_token: string; is_public: boolean }) => void;
}

export default function SubjectLibrary({
  subjects,
  quizzes,
  viewerId,
  loading = false,
  readOnly = false,
  heading = 'Subjects',
  onSubjectDeleted,
  onSubjectUpdated
}: SubjectLibraryProps) {
  const router = useRouter();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);

  const quizCounts = useMemo(() => {
    return new Map(
      subjects.map((subject) => [
        subject.id,
        quizzes.filter((quiz) => quiz.subject_id === subject.id).length
      ])
    );
  }, [subjects, quizzes]);

  const headingId = readOnly ? 'shared-subject-library-heading' : 'subject-library-heading';

  if (!loading && subjects.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {heading}
        </h2>
        <span className="rounded-lg border-2 border-slate-900 bg-[#86efac] text-slate-900 px-3 py-1 text-xs font-black shadow-brutal-sm">
          {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
        </span>
      </div>

      {loading ? (
        <div className="home-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-36 sm:h-[148px] rounded-2xl border-2 border-slate-900/30 dark:border-white/20 bg-muted/40 p-4 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="home-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject, index) => {
            const isPublic = subject.is_public !== false;
            const canManage = !readOnly && Boolean(viewerId && subject.user_id === viewerId);
            const canGeneratePublicLink = !readOnly && isPublic && !subject.share_token;
            const canOpen = readOnly || canManage || Boolean(isPublic && subject.share_token) || canGeneratePublicLink;
            const subjectHref = readOnly
              ? `/subjects/${subject.id}`
              : canManage
                ? `/subjects/${subject.id}`
                : subject.share_token
                  ? `/subjects/share/${subject.share_token}`
                  : '';
            const quizCount = quizCounts.get(subject.id) || 0;

            return (
              <article
                key={subject.id}
                role={canOpen ? 'link' : undefined}
                tabIndex={canOpen ? 0 : undefined}
                aria-label={`Open subject ${subject.name}`}
                onClick={() => {
                  if (readOnly || canManage || subject.share_token) router.push(subjectHref);
                  else if (canGeneratePublicLink) setSelectedSubject(subject);
                }}
                onKeyDown={(event) => {
                  if (canOpen && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    if (readOnly || canManage || subject.share_token) router.push(subjectHref);
                    else if (canGeneratePublicLink) setSelectedSubject(subject);
                  }
                }}
                style={{ animationDelay: `${index * 70}ms` }}
                className={`subject-card-enter group flex min-h-36 sm:min-h-[148px] flex-col justify-between rounded-2xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-4 sm:p-4.5 shadow-brutal transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_#0f172a] focus:outline-none focus:ring-2 focus:ring-primary/40 ${canOpen ? 'cursor-pointer' : ''}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: subject.color }}
                        className="h-9 w-9 shrink-0 rounded-xl border-2 border-slate-900 shadow-brutal-sm"
                      />
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-foreground transition-colors group-hover:text-primary">{subject.name}</h3>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                          <BookOpen className="h-3 w-3" />
                          {quizCount} {quizCount === 1 ? 'study set' : 'study sets'}
                          {!readOnly && canManage && (
                            <span className="ml-1 inline-flex items-center gap-1" title="Unique viewers">
                              <Eye aria-hidden="true" className="h-3 w-3" />
                              {subject.viewer_count ?? 0}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-slate-900 px-2 py-0.5 text-[10px] font-black shadow-brutal-sm ${isPublic ? 'bg-[#bfdbfe] text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                      {isPublic ? <Link2 className="h-3 w-3 stroke-[2.5]" /> : <Lock className="h-3 w-3 stroke-[2.5]" />}
                      {isPublic ? 'Link Active' : 'Private'}
                    </span>
                  </div>
                  {canOpen && (
                    <p className="mt-2 text-[11px] font-black text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                      {canManage ? 'Click to manage subject' : canGeneratePublicLink ? 'Click to get a share link' : 'Click to view shared study sets'}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t-2 border-slate-900/20 dark:border-white/20 pt-3">
                  {subject.share_token && isPublic ? (
                    <Link
                      href={`/subjects/share/${subject.share_token}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="text-xs font-black text-slate-700 dark:text-slate-300 transition-colors hover:text-primary underline underline-offset-4 decoration-2"
                    >
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink className="h-3.5 w-3.5" />
                        View link
                      </span>
                    </Link>
                  ) : isPublic ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedSubject(subject);
                      }}
                      className="text-xs font-black text-primary transition-colors hover:text-foreground underline underline-offset-4 decoration-2 cursor-pointer"
                    >
                      Get share link
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-muted-foreground">Link disabled</span>
                  )}
                  {canManage ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Delete ${subject.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteSubject(subject);
                        }}
                        className="inline-flex items-center justify-center rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-300 shadow-brutal-sm hover:bg-destructive hover:text-white hover:border-slate-900 hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSubject(subject);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-primary px-3 py-1 text-xs font-black text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-muted-foreground">Read-only</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ShareSubjectModal
        open={Boolean(selectedSubject)}
        onOpenChange={(open) => {
          if (!open) setSelectedSubject(null);
        }}
        subject={selectedSubject}
        readOnly={readOnly || Boolean(selectedSubject && selectedSubject.user_id !== viewerId)}
        onUpdated={(config) => {
          if (selectedSubject) onSubjectUpdated?.(selectedSubject.id, config);
        }}
      />
      <DeleteSubjectModal
        open={Boolean(deleteSubject)}
        onOpenChange={(open) => {
          if (!open) setDeleteSubject(null);
        }}
        subject={deleteSubject}
        reviewerCount={deleteSubject ? quizCounts.get(deleteSubject.id) || 0 : 0}
        onDeleted={(subjectId) => {
          setDeleteSubject(null);
          onSubjectDeleted?.(subjectId);
        }}
      />
    </section>
  );
}

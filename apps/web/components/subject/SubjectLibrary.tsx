'use client';

import React, { useMemo, useState } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import { BookOpen, ExternalLink, Layers, Link2, Lock, Share2, Trash2 } from 'lucide-react';
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
  onSubjectDeleted?: (subjectId: string) => void;
  onSubjectUpdated?: (subjectId: string, config: { share_token: string; is_public: boolean }) => void;
}

export default function SubjectLibrary({
  subjects,
  quizzes,
  viewerId,
  loading = false,
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

  if (!loading && subjects.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4" aria-labelledby="subject-library-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Your library</p>
          <h2 id="subject-library-heading" className="mt-1 text-lg font-extrabold tracking-tight text-foreground">
            Subjects
          </h2>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground">
          {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-44 rounded-3xl border border-border/40 bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject, index) => {
            const isPublic = subject.is_public !== false;
            const canManage = Boolean(viewerId && subject.user_id === viewerId);
            const canGeneratePublicLink = isPublic && !subject.share_token;
            const canOpen = canManage || Boolean(isPublic && subject.share_token) || canGeneratePublicLink;
            const subjectHref = canManage
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
                  if (canManage || subject.share_token) router.push(subjectHref);
                  else if (canGeneratePublicLink) setSelectedSubject(subject);
                }}
                onKeyDown={(event) => {
                  if (canOpen && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    if (canManage || subject.share_token) router.push(subjectHref);
                    else if (canGeneratePublicLink) setSelectedSubject(subject);
                  }
                }}
                style={{ animationDelay: `${index * 70}ms` }}
                className={`subject-card-enter group flex min-h-44 flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 ${canOpen ? 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md' : ''}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: subject.color }}
                        className="h-10 w-10 shrink-0 rounded-2xl border border-black/5 shadow-inner"
                      />
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-extrabold text-foreground">{subject.name}</h3>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <BookOpen className="h-3 w-3" />
                          {quizCount} {quizCount === 1 ? 'study set' : 'study sets'}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${isPublic ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {isPublic ? <Link2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {isPublic ? 'Link Active' : 'Private'}
                    </span>
                  </div>
                  {canOpen && (
                    <p className="mt-5 text-[11px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                      {canManage ? 'Click to manage subject' : canGeneratePublicLink ? 'Click to get a share link' : 'Click to view shared study sets'}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
                  {subject.share_token && isPublic ? (
                    <Link
                      href={`/subjects/share/${subject.share_token}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View shared link
                    </Link>
                  ) : isPublic ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedSubject(subject);
                      }}
                      className="text-[11px] font-semibold text-primary transition-colors hover:text-foreground"
                    >
                      Get share link
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground">Share link disabled</span>
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
                        className="inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSubject(subject);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white active:scale-95"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground">Read-only</span>
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
        readOnly={Boolean(selectedSubject && selectedSubject.user_id !== viewerId)}
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

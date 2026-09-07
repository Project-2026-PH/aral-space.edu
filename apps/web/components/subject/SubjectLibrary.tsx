'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import ShareSubjectModal from './ShareSubjectModal';
import DeleteSubjectModal from './DeleteSubjectModal';
import EditSubjectModal from './EditSubjectModal';
import SwipeableSubjectCard from './SwipeableSubjectCard';

interface SubjectLibraryProps {
  subjects: Subject[];
  quizzes: Quiz[];
  viewerId: string;
  loading?: boolean;
  readOnly?: boolean;
  heading?: string;
  onSubjectDeleted?: (subjectId: string) => void;
  onSubjectUpdated?: (subjectId: string, config: Partial<Subject>) => void;
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
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [swipedSubjectId, setSwipedSubjectId] = useState<string | null>(null);

  const quizCounts = useMemo(() => {
    return new Map(
      subjects.map((subject) => [
        subject.id,
        quizzes.filter((quiz) => quiz.subject_id === subject.id).length
      ])
    );
  }, [subjects, quizzes]);

  // Close open swipe card when tapping anywhere outside
  useEffect(() => {
    if (!swipedSubjectId) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.subject-card-enter')) {
        setSwipedSubjectId(null);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [swipedSubjectId]);

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
              <SwipeableSubjectCard
                key={subject.id}
                subject={subject}
                quizCount={quizCount}
                viewerId={viewerId}
                readOnly={readOnly}
                canManage={canManage}
                canOpen={canOpen}
                canGeneratePublicLink={canGeneratePublicLink}
                isPublic={isPublic}
                subjectHref={subjectHref}
                index={index}
                isOpen={swipedSubjectId === subject.id}
                onOpen={() => setSwipedSubjectId(subject.id)}
                onClose={() => {
                  if (swipedSubjectId === subject.id) setSwipedSubjectId(null);
                }}
                onEdit={() => {
                  setSwipedSubjectId(null);
                  setEditSubject(subject);
                }}
                onDelete={() => {
                  setSwipedSubjectId(null);
                  setDeleteSubject(subject);
                }}
                onShare={() => setSelectedSubject(subject)}
              />
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
      <EditSubjectModal
        open={Boolean(editSubject)}
        onOpenChange={(open) => {
          if (!open) setEditSubject(null);
        }}
        subject={editSubject}
        onUpdated={(updated) => {
          setEditSubject(null);
          onSubjectUpdated?.(updated.id, updated);
        }}
      />
    </section>
  );
}

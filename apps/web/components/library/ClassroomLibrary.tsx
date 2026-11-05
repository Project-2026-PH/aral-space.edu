'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { Classroom, ClassroomDetails, Subject } from '@quiz-creator/types';
import { Archive, BookOpen, Check, Copy, Link2, LoaderCircle, LockKeyhole, LogOut, Pencil, Plus, UserPlus, Users, X } from 'lucide-react';

interface ClassroomLibraryProps {
  subjects: Subject[];
  viewerId: string;
  selectedClassId: string;
  onSelectedClassChange: (classroomId: string) => void;
  onClassesChange?: (classrooms: Classroom[]) => void;
  onCountChange?: (count: number) => void;
}

interface ClassroomInviteResponse {
  id: string;
  code: string;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'The request could not be completed.');
  return body as T;
}

function jsonBody(value: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

const controlClass = 'w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-brutal-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-primary dark:border-white/40 dark:bg-slate-900 dark:text-white';
const secondaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-black text-slate-900 shadow-brutal-sm transition hover:-translate-y-0.5 hover:shadow-brutal disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/40 dark:bg-slate-800 dark:text-white';

export default function ClassroomLibrary({
  subjects,
  viewerId,
  selectedClassId,
  onSelectedClassChange,
  onClassesChange,
  onCountChange,
}: ClassroomLibraryProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [details, setDetails] = useState<ClassroomDetails | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const rows = await jsonRequest<Classroom[]>('/api/classes', { cache: 'no-store' });
      setClassrooms(rows);
      onClassesChange?.(rows);
      onCountChange?.(rows.length);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load classes.');
    } finally {
      setLoadingClasses(false);
    }
  }, [onClassesChange, onCountChange]);

  const loadDetails = useCallback(async (classId: string) => {
    setLoadingDetails(true);
    setError('');
    try {
      const row = await jsonRequest<ClassroomDetails>(`/api/classes/${encodeURIComponent(classId)}`, { cache: 'no-store' });
      setDetails(row);
      setEditName(row.name);
      setEditDescription(row.description || '');
    } catch (requestError) {
      setDetails(null);
      setError(requestError instanceof Error ? requestError.message : 'Could not load this class.');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!selectedClassId) {
      setDetails(null);
      return;
    }
    void loadDetails(selectedClassId);
  }, [selectedClassId, loadDetails]);

  useEffect(() => {
    if (!loadingClasses && selectedClassId && !classrooms.some((row) => row.id === selectedClassId)) {
      onSelectedClassChange('');
    }
  }, [classrooms, loadingClasses, onSelectedClassChange, selectedClassId]);

  const isOwner = details?.role === 'owner';
  const sharedSubjectIds = useMemo(() => new Set(details?.subjects.map((subject) => subject.id) || []), [details?.subjects]);
  const availableSubjects = useMemo(
    () => subjects.filter((subject) => subject.user_id === viewerId && !subject.archived_at && !sharedSubjectIds.has(subject.id)),
    [subjects, sharedSubjectIds, viewerId]
  );

  const runAction = async (action: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const createClassroom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction(async () => {
      const created = await jsonRequest<Classroom>('/api/classes', jsonBody({ name, description }));
      setName('');
      setDescription('');
      setCreateOpen(false);
      await loadClasses();
      onSelectedClassChange(created.id);
    }, 'Class created.');
  };

  const joinClassroom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction(async () => {
      const joined = await jsonRequest<{ classroom_id: string }>('/api/classes/join', jsonBody({ code: joinCode.trim() }));
      setJoinCode('');
      await loadClasses();
      onSelectedClassChange(joined.classroom_id);
    }, 'You joined the class.');
  };

  const saveClassroom = () => {
    if (!details) return;
    void runAction(async () => {
      const updated = await jsonRequest<Classroom>(`/api/classes/${encodeURIComponent(details.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDescription }),
      });
      setDetails((current) => current ? { ...current, ...updated } : current);
      setEditing(false);
      await loadClasses();
    }, 'Class details saved.');
  };

  const archiveClassroom = () => {
    if (!details || !window.confirm(`Archive “${details.name}”? Its members will lose access to this class and its shared subjects.`)) return;
    void runAction(async () => {
      await jsonRequest(`/api/classes/${encodeURIComponent(details.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      onSelectedClassChange('');
      setDetails(null);
      await loadClasses();
    }, 'Class archived.');
  };

  const createInvite = () => {
    if (!details) return;
    void runAction(async () => {
      const invite = await jsonRequest<ClassroomInviteResponse>(
        `/api/classes/${encodeURIComponent(details.id)}/invites`,
        jsonBody({})
      );
      setInviteUrl(`${window.location.origin}/classes/join/${encodeURIComponent(invite.code)}`);
      await loadDetails(details.id);
    }, 'Invite link created. Copy it now; the code is shown only once.');
  };

  const copyInvite = () => {
    if (!inviteUrl) return;
    void runAction(async () => {
      await navigator.clipboard.writeText(inviteUrl);
    }, 'Invite link copied.');
  };

  const revokeInvite = (inviteId: string) => {
    if (!details) return;
    void runAction(async () => {
      await jsonRequest(`/api/classes/${encodeURIComponent(details.id)}/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' });
      await loadDetails(details.id);
    }, 'Invite revoked.');
  };

  const removeMember = (memberId: string, index: number) => {
    if (!details || !window.confirm(`Remove learner ${index + 1} from this class?`)) return;
    void runAction(async () => {
      await jsonRequest(`/api/classes/${encodeURIComponent(details.id)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' });
      await loadDetails(details.id);
      await loadClasses();
    }, 'Learner removed.');
  };

  const leaveClassroom = () => {
    if (!details || !window.confirm(`Leave “${details.name}”? You will lose access to its shared subjects and study sets.`)) return;
    void runAction(async () => {
      await jsonRequest(`/api/classes/${encodeURIComponent(details.id)}/membership`, { method: 'DELETE' });
      onSelectedClassChange('');
      setDetails(null);
      await loadClasses();
    }, 'You left the class.');
  };

  const addSubject = (subjectId: string) => {
    if (!details) return;
    void runAction(async () => {
      await jsonRequest(`/api/classes/${encodeURIComponent(details.id)}/subjects`, jsonBody({ subject_id: subjectId }));
      await loadDetails(details.id);
      await loadClasses();
    }, 'Subject added to class.');
  };

  const removeSubject = (subjectId: string, name: string) => {
    if (!details || !window.confirm(`Remove “${name}” from this class? The subject and its original study sets will stay in your library.`)) return;
    void runAction(async () => {
      await jsonRequest(`/api/classes/${encodeURIComponent(details.id)}/subjects/${encodeURIComponent(subjectId)}`, { method: 'DELETE' });
      await loadDetails(details.id);
      await loadClasses();
    }, 'Subject removed from class.');
  };

  return (
    <section id="classes-section" className="space-y-5" aria-labelledby="classes-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-3 border-slate-900 bg-[#bfdbfe] p-4 shadow-brutal dark:border-white/30 dark:bg-slate-800 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-slate-900 bg-white shadow-brutal-sm dark:border-white/40 dark:bg-slate-900">
            <Users aria-hidden="true" className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 id="classes-heading" className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Classes</h2>
            <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">Private spaces for learners and shared subjects.</p>
          </div>
        </div>
        <button type="button" onClick={() => setCreateOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-[#fde047] px-3.5 py-2 text-xs font-black text-slate-950 shadow-brutal-sm transition hover:-translate-y-0.5 hover:shadow-brutal dark:border-white/40">
          {createOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {createOpen ? 'Close form' : 'Create class'}
        </button>
      </div>

      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-xl border-2 p-3 text-xs font-bold ${error ? 'border-rose-700 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : 'border-emerald-700 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
          {error || notice}
        </div>
      )}

      {classrooms.length > 0 && (
        <nav aria-label="Your classes" className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
          {classrooms.map((classroom) => (
            <button
              key={classroom.id}
              type="button"
              onClick={() => onSelectedClassChange(classroom.id)}
              aria-pressed={selectedClassId === classroom.id}
              className={`max-w-56 shrink-0 truncate rounded-full border-2 px-3 py-2 text-xs font-black transition ${selectedClassId === classroom.id ? 'border-slate-900 bg-[#fde047] text-slate-950 shadow-brutal-sm' : 'border-slate-900/20 bg-white text-slate-700 dark:border-white/25 dark:bg-card dark:text-slate-200'}`}
            >
              {classroom.name}
            </button>
          ))}
        </nav>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.6fr)]">
        <div className="order-2 space-y-4 xl:order-1">
          {createOpen && (
            <form onSubmit={createClassroom} className="space-y-3 rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-brutal-sm dark:border-white/30 dark:bg-card">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Create a class</h3>
              <label className="block space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                Class name
                <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="e.g. Biology 101" />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                Description <span className="font-medium text-muted-foreground">(optional)</span>
                <textarea className={controlClass} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} placeholder="What will learners study here?" />
              </label>
              <button type="submit" disabled={busy} className="w-full rounded-xl border-2 border-slate-900 bg-[#86efac] px-3 py-2 text-xs font-black text-slate-950 shadow-brutal-sm disabled:opacity-50 dark:border-white/40">
                {busy ? 'Creating…' : 'Create class'}
              </button>
            </form>
          )}

          <form onSubmit={joinClassroom} className="space-y-2 rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-brutal-sm dark:border-white/30 dark:bg-card">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><UserPlus aria-hidden="true" className="h-4 w-4" /> Join with an invite code</h3>
            <div className="flex gap-2">
              <input className={`${controlClass} min-w-0`} value={joinCode} onChange={(event) => setJoinCode(event.target.value)} maxLength={128} placeholder="Paste invite code" aria-label="Class invite code" />
              <button type="submit" disabled={busy || !joinCode.trim()} className="shrink-0 rounded-xl border-2 border-slate-900 bg-white px-3 text-xs font-black text-slate-900 shadow-brutal-sm disabled:opacity-50 dark:border-white/40 dark:bg-slate-800 dark:text-white">Join</button>
            </div>
          </form>

        </div>

        <div className="order-1 min-w-0 xl:order-2">
          {loadingDetails ? (
            <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-900/30 p-6 text-sm font-bold text-muted-foreground dark:border-white/20"><LoaderCircle className="h-5 w-5 animate-spin" /> Opening class…</div>
          ) : details ? (
            <div className="space-y-5 rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-brutal-sm dark:border-white/30 dark:bg-card sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-slate-900/10 pb-4 dark:border-white/10">
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <div className="space-y-2">
                      <input className={controlClass} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} aria-label="Class name" />
                      <textarea className={controlClass} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={2000} rows={2} aria-label="Class description" placeholder="Optional description" />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-xl font-black tracking-tight text-slate-950 dark:text-white">{details.name}</h3>
                        <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase text-primary">{details.role}</span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-700/30 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><LockKeyhole aria-hidden="true" className="h-3 w-3" /> Private</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{details.description || 'A private place to share study sets with learners.'}</p>
              <p className="mt-2 text-[10px] font-bold text-muted-foreground">{details.member_count} learners · {details.subjects.length} shared subjects</p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {isOwner && (editing ? (
                    <>
                      <button type="button" onClick={saveClassroom} disabled={busy || !editName.trim()} className={secondaryButtonClass}><Check className="h-3.5 w-3.5" /> Save</button>
                      <button type="button" onClick={() => { setEditing(false); setEditName(details.name); setEditDescription(details.description || ''); }} className={secondaryButtonClass}><X className="h-3.5 w-3.5" /> Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClass}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      <button type="button" onClick={archiveClassroom} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-800 bg-white px-3 py-2 text-xs font-black text-rose-800 shadow-brutal-sm hover:bg-rose-50 dark:bg-slate-900 dark:text-rose-300"><Archive className="h-3.5 w-3.5" /> Archive</button>
                    </>
                  ))}
                  {!isOwner && <button type="button" onClick={leaveClassroom} className={secondaryButtonClass}><LogOut className="h-3.5 w-3.5" /> Leave class</button>}
                </div>
              </div>

              {isOwner && (
                <section className="space-y-3 rounded-xl border-2 border-slate-900/15 bg-slate-50 p-3 dark:border-white/15 dark:bg-slate-900/60" aria-labelledby="class-invites-heading">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 id="class-invites-heading" className="text-xs font-black text-slate-900 dark:text-white">Learner invites</h4>
                      <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Anyone with an active link can join. Revoke it to stop new joins.</p>
                    </div>
                    <button type="button" onClick={createInvite} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-[#bfdbfe] px-2.5 py-1.5 text-[10px] font-black text-slate-950 shadow-brutal-sm disabled:opacity-50 dark:border-white/40"><Link2 className="h-3.5 w-3.5" /> Create invite link</button>
                  </div>
                  {inviteUrl && (
                    <div className="flex gap-2 rounded-xl border-2 border-slate-900 bg-white p-2 dark:border-white/30 dark:bg-card">
                      <input readOnly value={inviteUrl} aria-label="New private class invite link" className="min-w-0 flex-1 bg-transparent px-1 text-[10px] font-semibold text-slate-700 outline-none dark:text-slate-200" onFocus={(event) => event.currentTarget.select()} />
                      <button type="button" onClick={copyInvite} className="inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-slate-900 px-2 py-1 text-[10px] font-black text-slate-900 dark:border-white/40 dark:text-white"><Copy className="h-3 w-3" /> Copy</button>
                    </div>
                  )}
                  {(details.invites || []).length > 0 && (
                    <ul className="space-y-1.5">
                      {(details.invites || []).map((invite) => (
                        <li key={invite.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-[10px] font-bold dark:bg-card">
                          <span className="text-slate-700 dark:text-slate-200">{invite.revoked_at ? 'Revoked invite' : 'Active invite'} · created {new Date(invite.created_at).toLocaleDateString()}</span>
                          {!invite.revoked_at && <button type="button" onClick={() => revokeInvite(invite.id)} className="text-rose-700 underline underline-offset-2 dark:text-rose-300">Revoke</button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {isOwner && (
                <section className="space-y-2" aria-labelledby="class-members-heading">
                  <div className="flex items-center justify-between gap-2">
                    <h4 id="class-members-heading" className="text-sm font-black text-slate-900 dark:text-white">Learners</h4>
                    <span className="rounded-md border border-slate-900/20 bg-slate-100 px-2 py-0.5 text-[10px] font-black dark:border-white/20 dark:bg-slate-800">{details.members?.length || 0}</span>
                  </div>
                  {(details.members || []).length ? (
                    <ul className="divide-y divide-slate-900/10 rounded-xl border-2 border-slate-900/15 dark:divide-white/10 dark:border-white/15">
                      {(details.members || []).map((member, index) => (
                        <li key={member.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <span className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200"><Users className="h-4 w-4 text-primary" /> Learner {index + 1}</span>
                          <button type="button" onClick={() => removeMember(member.user_id, index)} className="text-[10px] font-black text-rose-700 underline underline-offset-2 dark:text-rose-300">Remove</button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="rounded-xl border border-dashed border-slate-900/20 p-3 text-xs font-semibold text-muted-foreground dark:border-white/20">No learners have joined yet.</p>}
                </section>
              )}

              <section className="space-y-3" aria-labelledby="class-subjects-heading">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 id="class-subjects-heading" className="text-sm font-black text-slate-900 dark:text-white">Subjects</h4>
                    <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Shared subjects include their active study sets, while the originals stay in your library.</p>
                  </div>
                  <span className="rounded-md border-2 border-slate-900 bg-[#fde047] px-2 py-1 text-[10px] font-black text-slate-950">{details.subjects.length} {details.subjects.length === 1 ? 'subject' : 'subjects'}</span>
                </div>
                {details.subjects.length ? (
                  <div className="space-y-3">
                    {details.subjects.map((subject) => (
                      <article key={subject.id} className="rounded-xl border-2 border-slate-900 bg-white p-3 shadow-brutal-sm dark:border-white/30 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-4 w-4 shrink-0 rounded-full border border-slate-900/20" style={{ backgroundColor: subject.color }} aria-hidden="true" />
                            <h5 className="truncate text-sm font-black text-slate-900 dark:text-white">{subject.name}</h5>
                            <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{subject.study_sets.length} sets</span>
                          </div>
                          {isOwner && <button type="button" onClick={() => removeSubject(subject.id, subject.name)} className="shrink-0 text-[10px] font-black text-rose-700 underline underline-offset-2 dark:text-rose-300">Remove subject</button>}
                        </div>
                        {subject.study_sets.length ? (
                          <ul className="mt-2 divide-y divide-slate-900/10 border-t border-slate-900/10 dark:divide-white/10 dark:border-white/10">
                            {subject.study_sets.map((studySet) => (
                              <li key={studySet.id} className="flex items-center justify-between gap-3 py-2 first:pt-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                                  <span className="min-w-0 truncate text-xs font-bold text-slate-800 dark:text-slate-200">{studySet.title}</span>
                                  <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{studySet.question_count} questions</span>
                                </div>
                                <Link href={`/review/test/${encodeURIComponent(studySet.id)}`} className="shrink-0 rounded-lg border-2 border-slate-900 bg-[#bfdbfe] px-2.5 py-1.5 text-[10px] font-black text-slate-950 shadow-brutal-sm hover:-translate-y-0.5 dark:border-white/30">Study</Link>
                              </li>
                            ))}
                          </ul>
                        ) : <p className="mt-2 border-t border-slate-900/10 pt-2 text-[10px] font-semibold text-muted-foreground dark:border-white/10">No active study sets in this subject yet.</p>}
                      </article>
                    ))}
                  </div>
                ) : <p className="rounded-xl border border-dashed border-slate-900/20 p-4 text-xs font-semibold text-muted-foreground dark:border-white/20">No subjects have been added to this class.</p>}

                {isOwner && (
                  <div className="space-y-2 rounded-xl border-2 border-slate-900/15 bg-slate-50 p-3 dark:border-white/15 dark:bg-slate-900/60">
                    <h5 className="text-xs font-black text-slate-900 dark:text-white">Add one of your subjects</h5>
                    {availableSubjects.length ? (
                      <div className="space-y-1.5">
                        {availableSubjects.map((subject) => (
                          <div key={subject.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-2 dark:bg-card">
                            <span className="min-w-0 truncate text-xs font-bold text-slate-800 dark:text-slate-200">{subject.name}</span>
                            <button type="button" onClick={() => addSubject(subject.id)} disabled={busy} aria-label={`Add ${subject.name} to class`} className="inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-slate-900 bg-[#86efac] px-2 py-1 text-[10px] font-black text-slate-950 disabled:opacity-50 dark:border-white/30"><Plus className="h-3 w-3" /> Add</button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[10px] font-semibold text-muted-foreground">All your subjects are already in this class, or you do not own any subjects yet.</p>}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-900/30 bg-slate-50 p-6 text-center dark:border-white/20 dark:bg-slate-900/40">
              <Users aria-hidden="true" className="h-8 w-8 text-primary" />
              <h3 className="mt-3 text-base font-black text-slate-900 dark:text-white">Choose a class</h3>
              <p className="mt-1 max-w-sm text-xs font-semibold text-muted-foreground">Open a class to manage learners and shared sets, or study materials your class owner has added.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

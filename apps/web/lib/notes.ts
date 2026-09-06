import { EMPTY_RICH_TEXT } from './richText';

export interface NoteDocument {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isDraft?: boolean;
}

const NOTES_STORAGE_KEY = 'quiz-creator:notes:v1';
const ACTIVE_NOTE_STORAGE_KEY = 'quiz-creator:notes:active-id';

export function loadNotes(): NoteDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter((note) => note && typeof note.id === 'string')
          .map((note) => ({
            ...note,
            isDraft: typeof note.isDraft === 'boolean' ? note.isDraft : false,
          }))
      : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: NoteDocument[]): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

export function loadActiveNoteId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_NOTE_STORAGE_KEY) || null;
}

export function saveActiveNoteId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) {
    window.localStorage.setItem(ACTIVE_NOTE_STORAGE_KEY, id);
  } else {
    window.localStorage.removeItem(ACTIVE_NOTE_STORAGE_KEY);
  }
}

export function createNote(): NoteDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'Untitled note',
    content: EMPTY_RICH_TEXT,
    createdAt: now,
    updatedAt: now,
    isDraft: true,
  };
}

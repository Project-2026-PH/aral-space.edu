import { EMPTY_RICH_TEXT } from './richText';

export interface NoteDocument {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const NOTES_STORAGE_KEY = 'quiz-creator:notes:v1';

export function loadNotes(): NoteDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((note) => note && typeof note.id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: NoteDocument[]): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

export function createNote(): NoteDocument {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: 'Untitled note', content: EMPTY_RICH_TEXT, createdAt: now, updatedAt: now };
}

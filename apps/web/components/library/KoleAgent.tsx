'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, BookOpen, ChevronDown, LoaderCircle, Sparkles, X } from 'lucide-react';
import type { Quiz, Subject } from '@quiz-creator/types';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type KoleAgentProps = {
  quizzes: Quiz[];
  sharedQuizzes: Quiz[];
  subjects: Subject[];
  sharedSubjects: Subject[];
};

type KoleAvatarSize = 'sm' | 'md' | 'lg';
type KoleAvatarEmotion = 'idle' | 'thinking';

type QuizOption = {
  id: string;
  title: string;
  subjectName: string;
  scope: 'Your set' | 'Shared set';
};

const SUGGESTED_PROMPTS = [
  "I can't understand a set",
  "I'm cramming",
  'Topic overview',
  'How do I review the whole set?',
] as const;

const WELCOME_MESSAGE =
  "Hi! I'm Kole, your bubbly study buddy. Pick a set or ask me anything about reviewing smarter — no judgment, just tiny steps and big wins!";

function createMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `kole-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function KoleAvatar({
  size = 'md',
  emotion = 'idle',
  animated = false,
  decorative = false,
}: {
  size?: KoleAvatarSize;
  emotion?: KoleAvatarEmotion;
  animated?: boolean;
  decorative?: boolean;
}) {
  return (
    <span
      className={`kole-avatar kole-avatar--${size} kole-avatar--emotion-${emotion} ${animated ? 'kole-avatar--animated' : 'kole-avatar--static'}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Kole, your study buddy'}
      aria-hidden={decorative || undefined}
    >
      <span className="kole-avatar-face" aria-hidden="true">
        {emotion === 'thinking' ? (
          <>
            <span className="kole-avatar-eye" />
            <span className="kole-avatar-eye" />
            <span className="kole-avatar-thought" />
          </>
        ) : (
          <>
            <span className="kole-avatar-idle-eye">
              <span className="kole-avatar-idle-eye-shape" />
            </span>
            <span className="kole-avatar-idle-eye">
              <span className="kole-avatar-idle-eye-shape" />
            </span>
            <span className="kole-avatar-idle-mouth" />
          </>
        )}
      </span>
    </span>
  );
}

export default function KoleAgent({
  quizzes,
  sharedQuizzes,
  subjects,
  sharedSubjects,
}: KoleAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'kole-welcome', role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quizOptions = useMemo(() => {
    const subjectNames = new Map<string, string>([
      ...subjects.map((subject) => [subject.id, subject.name] as const),
      ...sharedSubjects.map((subject) => [subject.id, subject.name] as const),
    ]);
    const seen = new Set<string>();
    const options: QuizOption[] = [];

    const addOptions = (items: Quiz[], scope: QuizOption['scope']) => {
      items.forEach((quiz) => {
        if (seen.has(quiz.id)) return;
        seen.add(quiz.id);
        options.push({
          id: quiz.id,
          title: quiz.title || 'Untitled set',
          subjectName: quiz.subject?.name || (quiz.subject_id ? subjectNames.get(quiz.subject_id) : '') || 'General study',
          scope,
        });
      });
    };

    addOptions(quizzes, 'Your set');
    addOptions(sharedQuizzes, 'Shared set');
    return options;
  }, [quizzes, sharedQuizzes, subjects, sharedSubjects]);

  const contextQuizIds = useMemo(
    () => (selectedQuizId ? [selectedQuizId] : quizOptions.slice(0, 6).map((option) => option.id)),
    [quizOptions, selectedQuizId],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => inputRef.current?.focus());

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isSending]);

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || isSending) return;

    const userMessage: ChatMessage = { id: createMessageId(), role: 'user', content: message };
    const history = messages.slice(-7).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/ai/kole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          quizIds: contextQuizIds,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Kole could not reply right now.');

      const reply = typeof payload.reply === 'string' && payload.reply.trim()
        ? payload.reply.trim()
        : 'I had a tiny brain-lag. Try sending that again and I’ll be right back!';
      setMessages((current) => [...current, { id: createMessageId(), role: 'assistant', content: reply }]);
    } catch (error) {
      console.error('Kole chat request failed:', error);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: 'Oopsie, I could not reach my study sparkle right now. Try again in a moment, okay?',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const isFresh = messages.length === 1;

  return (
    <div className="fixed bottom-5 right-5 z-[90] sm:bottom-6 sm:right-6">
      {isOpen && (
        <section
          className="kole-agent-modal absolute bottom-0 right-0 flex w-[calc(100vw-2rem)] max-w-[360px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5 dark:border-white/15 dark:bg-card dark:ring-white/5"
          role="dialog"
          aria-modal="false"
          aria-labelledby="kole-agent-heading"
        >
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-2.5">
              <KoleAvatar size="sm" decorative />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">AI Chat</p>
                <h2 id="kole-agent-heading" className="truncate text-base font-black text-slate-900 dark:text-white">
                  Ask Ko-le
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Kole chat"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="kole-chat-scroll min-h-0 max-h-[min(360px,calc(100vh-15rem))] flex-1 overflow-y-auto px-3.5 py-3.5">
            {isFresh ? (
              <div className="flex min-h-44 flex-col items-center justify-center text-center">
                <KoleAvatar size="lg" decorative />
                <p className="mt-4 text-lg font-black tracking-tight text-slate-900 dark:text-white">Ask Ko-le anything</p>
                <p className="mt-1 max-w-xs text-xs font-semibold leading-relaxed text-slate-400">
                  I can turn a giant reviewer into a friendly little game plan.
                </p>
              </div>
            ) : (
              <div className="space-y-3" aria-live="polite">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[90%] items-end gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {message.role === 'assistant' && <KoleAvatar size="sm" decorative />}
                      <p
                        className={`rounded-2xl px-3.5 py-2.5 text-sm font-semibold leading-relaxed ${
                          message.role === 'user'
                            ? 'rounded-br-md bg-sky-50 text-sky-700 dark:bg-primary/15 dark:text-sky-100'
                            : 'rounded-bl-md bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-100'
                        }`}
                      >
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <KoleAvatar size="sm" emotion="thinking" decorative />
                    <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 dark:bg-white/10">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Kole is thinking...
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-white/10">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Suggested questions for Kole">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={isSending}
                  className="kole-suggestion shrink-0 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-left text-[10px] font-black text-sky-700 transition hover:-translate-y-0.5 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-primary/10 dark:text-sky-100"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <BookOpen className="ml-1 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <label htmlFor="kole-set-context" className="sr-only">Choose the reviewer set Kole should use</label>
              <div className="relative min-w-0 flex-1">
                <select
                  id="kole-set-context"
                  value={selectedQuizId}
                  onChange={(event) => setSelectedQuizId(event.target.value)}
                  className="w-full appearance-none truncate rounded-lg border border-transparent bg-transparent py-1 pr-6 text-[10px] font-black text-slate-400 outline-none transition hover:border-slate-200 focus:border-primary dark:hover:border-white/15"
                >
                  <option value="">My Sets ({quizOptions.length})</option>
                  {quizOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title} · {option.scope} · {option.subjectName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2 rounded-full bg-slate-100 p-1.5 dark:bg-white/10">
              <label htmlFor="kole-message" className="sr-only">Message Kole</label>
              <input
                ref={inputRef}
                id="kole-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="How else can I help?"
                maxLength={2_000}
                disabled={isSending}
                className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
              />
              <button
                type="submit"
                aria-label="Send message to Kole"
                disabled={isSending || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition hover:scale-105 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Kole study buddy"
          aria-expanded={isOpen}
          className="group relative flex h-12 w-12 items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none ring-0 transition duration-200 hover:-translate-y-1 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/40"
        >
          <KoleAvatar size="sm" animated decorative />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-full right-0 mb-3 translate-y-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-black text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100">
            Ask Ko-le
          </span>
        </button>
      )}
    </div>
  );
}

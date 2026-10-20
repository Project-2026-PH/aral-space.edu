'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Mic, MicOff, Send, X } from 'lucide-react';
import type { QuizMode, QuizQuestion } from '@quiz-creator/types';
import { KoleAvatar } from '@/components/library/KoleAgent';

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type Props = {
  mode: QuizMode;
  question: QuizQuestion;
};

function questionContext(question: QuizQuestion, mode: QuizMode): string {
  const options = Array.isArray(question.options) && question.options.length > 0
    ? `\nChoices: ${question.options.join(' | ')}`
    : '';
  return `Mode: ${mode}\nQuestion: ${question.question_text}${options}\nDo not reveal the correct answer. Help the student understand the wording, concept, or approach.`;
}

export default function KoleQuizCoach({ mode, question }: Props) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef('');

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const startListening = () => {
    setError('');
    setTranscript('');
    transcriptRef.current = '';
    const speechWindow = window as Window & typeof globalThis & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Voice input is not supported in this browser. You can type your question instead.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim();
      if (text) {
        transcriptRef.current = text;
        setTranscript(text);
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setError('I could not hear that. Try again or type what is confusing you.');
    };
    recognition.onend = () => {
      setListening(false);
      const spokenText = transcriptRef.current.trim();
      if (spokenText) window.setTimeout(() => void askKole(spokenText), 150);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const askKole = async (spokenText = transcriptRef.current) => {
    const message = spokenText.trim();
    if (!message || isSending) return;
    setIsSending(true);
    setError('');
    try {
      const response = await fetch('/api/ai/kole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: [], quizIds: [], coachContext: questionContext(question, mode) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.reply !== 'string') throw new Error('Kole could not respond right now.');
      setReply(payload.reply);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(payload.reply));
      }
    } catch (requestError) {
      console.error('Kole quiz coach request failed:', requestError);
      setError('Kole could not respond right now. Try again in a moment.');
    } finally {
      setIsSending(false);
    }
  };

  const openCoach = () => {
    setOpen(true);
    setReply('Hi, which part of the question confuses you?');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const greeting = new SpeechSynthesisUtterance('Hi, which part of the question confuses you?');
      greeting.onend = startListening;
      window.speechSynthesis.speak(greeting);
    } else {
      startListening();
    }
  };

  if (mode === 'flashcard') return null;

  return (
    <div className="relative z-10 flex justify-end px-1 pt-2" onClick={(event) => event.stopPropagation()}>
      {!open ? (
        <button type="button" onClick={openCoach} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[10px] font-black text-primary transition hover:bg-primary/10" aria-label="Talk to Kole about this question">
          <KoleAvatar size="sm" decorative />
          <Mic className="h-3 w-3" aria-hidden="true" /> Talk to Kole
        </button>
      ) : (
        <div className="w-full max-w-sm rounded-2xl border border-primary/20 bg-card p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <KoleAvatar size="sm" emotion={listening ? 'thinking' : 'idle'} decorative className={listening ? 'kole-avatar--voice-listening' : ''} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-foreground">{listening ? 'Kole is listening…' : 'Ask Kole about this question'}</p>
                <button type="button" onClick={() => { stopListening(); setOpen(false); }} aria-label="Close Kole coach" className="rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
              </div>
              <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Speak in English or your preferred language.</p>
            </div>
          </div>
          {reply && <div className="mt-2 rounded-xl bg-muted/60 px-2.5 py-2 text-xs font-semibold leading-relaxed text-foreground">{reply}</div>}
          <textarea value={transcript} onChange={(event) => { transcriptRef.current = event.target.value; setTranscript(event.target.value); }} placeholder="What part is confusing?" rows={2} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground outline-none focus:border-primary" />
          {error && <p role="alert" className="mt-1 text-[10px] font-bold text-destructive">{error}</p>}
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={listening ? stopListening : startListening} disabled={isSending} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[10px] font-black ${listening ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>
              {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {listening ? 'Stop listening' : 'Speak to Kole'}
            </button>
            <button type="button" onClick={() => void askKole()} disabled={isSending || !transcript.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-2.5 py-2 text-[10px] font-black text-foreground disabled:opacity-40">
              {isSending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

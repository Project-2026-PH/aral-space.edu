'use client';

import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { QuizMode } from '@quiz-creator/types';
import { Play, Sparkles, BookOpen, PenTool, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface QuizStartConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  title: string;
}

export default function QuizStartConfigModal({
  open,
  onOpenChange,
  quizId,
  title
}: QuizStartConfigModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<QuizMode>('learn');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(true);

  function handleStart() {
    onOpenChange(false);
    const query = new URLSearchParams({
      mode,
      shuffleQuestions: String(shuffleQuestions),
      shuffleOptions: String(shuffleOptions)
    }).toString();

    router.push(`/practice/${quizId}?${query}`);
  }

  const modes = [
    // {
    //   id: 'learn' as QuizMode,
    //   name: 'Learn Mode',
    //   desc: 'Type the answer, get immediate feedback, and build mastery through active recall.',
    //   icon: PenTool
    // },
    {
      id: 'multiple_choice' as QuizMode,
      name: 'Multiple Choice',
      desc: 'Choose from the available options when a card has multiple-choice distractors.',
      icon: Layers
    },
    {
      id: 'flashcard' as QuizMode,
      name: 'Flashcards',
      desc: 'Self-paced 3D flip card review for active recall.',
      icon: BookOpen
    },
    {
      id: 'identification' as QuizMode,
      name: 'Identification',
      desc: 'Legacy typed-answer mode for existing quiz cards.',
      icon: PenTool
    }
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Start Learning Session"
      description={`Configure session settings for "${title}".`}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Study Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {modes.map((m) => {
              const Icon = m.icon;
              const isSelected = mode === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-2xl border p-3 cursor-pointer transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-muted text-foreground'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{m.name}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{m.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 space-y-2">
          <label className="flex items-center justify-between text-xs font-semibold text-foreground cursor-pointer">
            <span>Shuffle Question Sequence</span>
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
          </label>
          <label className={`flex items-center justify-between text-xs font-semibold text-foreground ${mode === 'multiple_choice' ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <span>Randomize Choices Positions</span>
            <input
              type="checkbox"
              checked={shuffleOptions}
              disabled={mode !== 'multiple_choice'}
              onChange={(e) => setShuffleOptions(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white hover:bg-primary/90 transition-all active:scale-95 shadow-md shadow-primary/20"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Begin Session</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

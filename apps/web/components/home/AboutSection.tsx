'use client';

import React, { useState } from 'react';
import { FileText, Sparkles, Users, Shuffle, RotateCcw } from 'lucide-react';

interface FlashcardData {
  id: string;
  title: string;
  cardBg: string;
  textColor: string;
  titleColor?: string;
  dividerColor?: string;
  badgeColor?: string;
  sticker: {
    icon: React.ReactNode;
    bg: string;
  };
  whatItDoes: string;
  details: {
    label?: string;
    text: string;
  }[];
  exampleTitle?: string;
  exampleText?: string;
  exampleTrueFalse?: {
    term: string;
    def: string;
    whenTrue: string;
    whenFalse: string;
  };
}

const flashcards: FlashcardData[] = [
  {
    id: 'smart-copy-paste',
    title: 'Smart Copy-Paste',
    cardBg: 'bg-[#1c187e] border-3 border-slate-900 shadow-brutal',
    textColor: 'text-white',
    dividerColor: 'border-white/20',
    badgeColor: 'bg-blue-900/60 text-blue-200 border-white/30',
    sticker: {
      icon: <FileText className="w-5 h-5 text-[#1c187e]" strokeWidth={2.5} />,
      bg: 'bg-white border-2 border-slate-900 shadow-brutal-sm',
    },
    whatItDoes:
      "You don't need to manually copy terms and definitions into separate input boxes. Just copy notes from your PDF, slide presentation, website, or Excel sheet, paste it into the quiz creator, and the system automatically figures out:",
    details: [
      { label: 'Term Detection', text: 'Which part is the Term (the vocabulary word or concept name).' },
      { label: 'Definition Parsing', text: 'Which part is the Definition (what it means or describes).' },
      { label: 'Batch Lists', text: 'Whether you pasted a single item or a whole list of bullet points.' },
    ],
    exampleTitle: 'Real-world example',
    exampleText:
      'If you copy "• Mitosis: The process of cell division resulting in two daughter cells", the app instantly creates a card with "The process of cell division resulting in two daughter cells" as the prompt and "Mitosis" as the answer.',
  },
  {
    id: 'instant-question-formatting',
    title: 'Instant Question Formatting',
    titleColor: 'text-blue-600 dark:text-blue-400',
    cardBg: 'bg-white dark:bg-[#101526] text-slate-900 dark:text-white border-3 border-slate-900 dark:border-white/40 shadow-brutal',
    textColor: 'text-slate-900 dark:text-white',
    dividerColor: 'border-slate-900/15 dark:border-white/20',
    badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-slate-900/20',
    sticker: {
      icon: <Sparkles className="w-5 h-5 text-white" strokeWidth={2.5} />,
      bg: 'bg-blue-600 border-2 border-slate-900 shadow-brutal-sm',
    },
    whatItDoes:
      'Once a definition is pasted, the app turns it into whatever study format you want without needing extra typing:',
    details: [
      {
        label: 'Identification / Flashcards',
        text: 'Shows the definition, asks you to name the term.',
      },
      {
        label: 'Multiple Choice',
        text: "Don't have time to write 3 wrong choices? The app automatically borrows plausible terms from your other cards in the same quiz to create a 4-choice quiz.",
      },
      {
        label: 'Reverse Mode',
        text: 'Asks you "Which term matches this definition?" to test your memory in both directions.',
      },
    ],
  },
  {
    id: 'smart-true-false-generator',
    title: 'Smart True or False Generator',
    cardBg: 'bg-[#2563eb] border-3 border-slate-900 shadow-brutal',
    textColor: 'text-white',
    dividerColor: 'border-white/20',
    badgeColor: 'bg-blue-800/60 text-blue-100 border-white/30',
    sticker: {
      icon: <Users className="w-5 h-5 text-[#2563eb]" strokeWidth={2.5} />,
      bg: 'bg-white border-2 border-slate-900 shadow-brutal-sm',
    },
    whatItDoes:
      'When you switch a question to "True or False", the app doesn\'t leave raw notes as a question—it rewrites the definition and the term together into a smooth, natural-sounding sentence (just like a teacher would write on an exam).',
    details: [
      {
        label: 'For a TRUE statement',
        text: 'Combines the correct term with its actual definition.',
      },
      {
        label: 'For a FALSE statement',
        text: 'Instead of adding clumsy words like "not" or "does not", it takes a related term from another question in your deck and swaps it in.',
      },
    ],
    exampleTrueFalse: {
      term: 'Stage 1: New Processes',
      def: 'It involves envisioning physical operations more effectively with information...',
      whenTrue: 'Stage 1: New Processes involves envisioning physical operations more effectively with information... (Answer: True)',
      whenFalse: 'Stage 2: New Marketplace involves envisioning physical operations more effectively with information... (Answer: False — it actually describes Stage 1!)',
    },
  },
];

export default function AboutSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  const card = flashcards[currentIndex];

  const handleShuffle = () => {
    setIsFlipped(false);
    setIsShuffling(true);

    setTimeout(() => {
      setCurrentIndex((prev) => {
        let next = Math.floor(Math.random() * flashcards.length);
        if (next === prev) {
          next = (prev + 1) % flashcards.length;
        }
        return next;
      });
      setIsShuffling(false);
    }, 200);
  };

  return (
    <section id="about-us" className="relative w-full py-12 sm:py-16 overflow-hidden">
      {/* Background Floating Space Decor: Stars & Aral Space Badges */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Floating Star - Top Left */}
        <div className="absolute top-12 left-4 sm:left-12 lg:left-24 animate-doodle-float hidden sm:flex items-center gap-1.5 opacity-90">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#101526] border-2 border-slate-900 shadow-brutal-sm flex items-center justify-center -rotate-12">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border-2 border-slate-900 shadow-brutal-sm -rotate-6">
            Aral Space
          </span>
        </div>

        {/* Floating Star - Top Right */}
        <div className="absolute top-16 right-4 sm:right-12 lg:right-28 animate-doodle-float [animation-delay:1.5s] hidden sm:flex items-center gap-1.5 opacity-90">
          <span className="bg-white dark:bg-[#101526] text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border-2 border-slate-900 shadow-brutal-sm rotate-6">
            ★ ARAL ///
          </span>
          <div className="w-11 h-11 rounded-full bg-[#2563eb] border-2 border-slate-900 shadow-brutal-sm flex items-center justify-center rotate-12">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Floating Star - Mid Left Near Card */}
        <div className="absolute top-1/2 -translate-y-1/2 left-2 sm:left-8 lg:left-36 animate-doodle-float [animation-delay:2.5s] hidden md:block opacity-85">
          <div className="w-12 h-12 rounded-2xl bg-blue-500 border-2 border-slate-900 shadow-brutal-sm flex items-center justify-center -rotate-6">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Floating Star & Aral Space Badge - Bottom Right Near Card */}
        <div className="absolute bottom-16 right-2 sm:right-8 lg:right-32 animate-doodle-float [animation-delay:0.8s] hidden md:flex flex-col items-center gap-1 opacity-90">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#101526] border-2 border-slate-900 shadow-brutal-sm flex items-center justify-center rotate-12">
            <Sparkles className="w-5 h-5 text-[#2563eb]" />
          </div>
          <span className="bg-[#2563eb] text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-slate-900 shadow-brutal-sm -rotate-3">
            Aral Space
          </span>
        </div>
      </div>

      {/* Section Header */}
      <div className="max-w-3xl mx-auto text-center space-y-3 px-4 mb-10">
        <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-900 bg-blue-600 text-white px-3.5 py-1 text-xs font-black uppercase tracking-wider shadow-brutal-sm">
          <Sparkles className="h-3.5 w-3.5" />
          About Aral Space
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
          Built For Curious Minds
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          A local-first study space designed to convert your handouts into high-retention reviewers and interactive notes.
        </p>
      </div>

      {/* Single 3D Flippable Flashcard Container */}
      <div className="max-w-md sm:max-w-lg mx-auto px-4 relative z-10">
        
        {/* Card Stage with 3D Perspective */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Flip ${card.title} card`}
          onClick={() => setIsFlipped(!isFlipped)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsFlipped(!isFlipped);
            }
          }}
          className={`relative w-full min-h-[460px] sm:min-h-[490px] cursor-pointer select-none [perspective:1200px] transition-transform duration-200 ${
            isShuffling ? 'scale-95 opacity-80' : 'hover:-translate-y-1'
          }`}
        >
          {/* Flipper Body */}
          <div
            className={`relative w-full min-h-[460px] sm:min-h-[490px] transition-transform duration-500 ease-out [transform-style:preserve-3d] ${
              isFlipped ? '[transform:rotateY(180deg)]' : ''
            }`}
          >
            {/* ================= FRONT SIDE ================= */}
            <div
              className={`absolute inset-0 w-full h-full rounded-3xl p-7 sm:p-9 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(0deg)] ${card.cardBg} ${card.textColor}`}
            >
              {/* Sticker Badge on Top Edge */}
              <div
                className={`absolute -top-5 left-1/2 -translate-x-1/2 flex items-center justify-center p-2.5 rounded-xl ${card.sticker.bg} shadow-brutal-sm`}
              >
                {card.sticker.icon}
              </div>

              {/* Card Meta Header (Clean without FRONT label) */}
              <div className="flex items-center justify-between pt-1">
                <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${card.badgeColor || 'border-white/20'}`}>
                  Card {currentIndex + 1} of {flashcards.length}
                </span>
              </div>

              {/* Front Content: Big Bold Title (No Subheading) */}
              <div className="my-auto py-8 text-center">
                <h3 className={`text-3xl sm:text-5xl font-black tracking-tight lowercase ${card.titleColor || ''}`}>
                  {card.title}
                </h3>
              </div>

              {/* Flip Hint Bar */}
              <div className="pt-4 border-t-2 border-current/15 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider opacity-85">
                <RotateCcw className="w-3.5 h-3.5 animate-spin-slow" />
                <span>Tap to view features</span>
              </div>
            </div>

            {/* ================= BACK SIDE (FEATURES) ================= */}
            <div
              className={`absolute inset-0 w-full h-full rounded-3xl p-6 sm:p-7 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)] ${card.cardBg} ${card.textColor}`}
            >
              {/* Back Header */}
              <div className="flex items-center justify-between pb-2.5 border-b-2 border-current/15">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded border border-current/20">
                    Key Features
                  </span>
                  <h3 className={`text-base sm:text-lg font-black tracking-tight ${card.titleColor || ''}`}>
                    {card.title}
                  </h3>
                </div>
                <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${card.badgeColor || 'border-white/20'}`}>
                  {currentIndex + 1}/{flashcards.length}
                </span>
              </div>

              {/* Scrollable / Structured Content Area */}
              <div
                className={`flex-1 overflow-y-auto pr-1 py-3 space-y-3.5 text-xs sm:text-[13px] leading-relaxed select-text ${
                  card.id === 'instant-question-formatting'
                    ? 'custom-scrollbar-card-light'
                    : 'custom-scrollbar-card'
                }`}
              >
                {/* What it does */}
                <div className="space-y-1">
                  <span className="font-mono font-black text-[10px] uppercase tracking-wider opacity-75 block">
                    What it does:
                  </span>
                  <p className="font-medium opacity-95">
                    {card.whatItDoes}
                  </p>
                </div>

                {/* Details / Bullets */}
                <ul className="space-y-1.5 pt-0.5">
                  {card.details.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono font-black shrink-0 mt-0.5 opacity-80 text-sm">
                        •
                      </span>
                      <div>
                        {item.label && (
                          <span className="font-bold underline decoration-current/30 underline-offset-2 mr-1.5">
                            {item.label}:
                          </span>
                        )}
                        <span className="font-normal opacity-90">{item.text}</span>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Optional Real-World Example */}
                {card.exampleText && (
                  <div className="p-2.5 rounded-xl bg-black/15 dark:bg-white/5 border border-current/15 space-y-1">
                    <span className="font-mono font-black text-[10px] uppercase tracking-wider block opacity-80">
                      {card.exampleTitle || 'Real-world example'}:
                    </span>
                    <p className="text-[11px] sm:text-xs font-medium opacity-90 italic">
                      {card.exampleText}
                    </p>
                  </div>
                )}

                {/* Optional True/False Example Breakdown */}
                {card.exampleTrueFalse && (
                  <div className="p-2.5 rounded-xl bg-black/15 dark:bg-white/5 border border-current/15 space-y-2 text-[11px] sm:text-xs">
                    <span className="font-mono font-black text-[10px] uppercase tracking-wider block opacity-80">
                      Example in action:
                    </span>
                    <div className="space-y-1 opacity-90">
                      <p><span className="font-bold">Term:</span> {card.exampleTrueFalse.term}</p>
                      <p><span className="font-bold">Original:</span> &ldquo;{card.exampleTrueFalse.def}&rdquo;</p>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-current/15 font-semibold">
                      <p className="text-emerald-300 dark:text-emerald-400">
                        <span className="font-black underline">TRUE:</span> {card.exampleTrueFalse.whenTrue}
                      </p>
                      <p className="text-rose-300 dark:text-rose-400">
                        <span className="font-black underline">FALSE:</span> {card.exampleTrueFalse.whenFalse}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Flip Back Hint Bar */}
              <div className="pt-2 border-t-2 border-current/15 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider opacity-85">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tap to flip back</span>
              </div>
            </div>

          </div>
        </div>

        {/* Shuffle Button (No Left/Right buttons) */}
        <div className="mt-8 flex items-center justify-center">
          <button
            type="button"
            onClick={handleShuffle}
            className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black text-xs sm:text-sm uppercase tracking-wider px-8 py-3.5 border-2 border-slate-900 shadow-brutal transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95"
          >
            <Shuffle className={`w-4 h-4 ${isShuffling ? 'animate-spin' : ''}`} />
            <span>Shuffle Card</span>
          </button>
        </div>

        {/* Card Dots Indicator */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {flashcards.map((fc, idx) => (
            <button
              key={fc.id}
              onClick={() => {
                setIsFlipped(false);
                setCurrentIndex(idx);
              }}
              aria-label={`Go to card ${idx + 1}`}
              className={`h-2.5 rounded-full border border-slate-900 transition-all ${
                currentIndex === idx
                  ? 'w-8 bg-blue-600'
                  : 'w-2.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}

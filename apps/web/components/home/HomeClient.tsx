'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import EditorialHeroGrid from '@/components/home/EditorialHeroGrid';
import AboutSection from '@/components/home/AboutSection';

export interface HomeClientProps {
  initialQuizzes?: unknown[];
  initialSubjects?: unknown[];
  viewerId?: string;
}
const [started, setStarted] = useState(false);

export default function HomeClient({ }: HomeClientProps) {
  return (
    <div className="home-page pb-16 overflow-x-hidden">
      {/* Neo-brutalist Editorial Hero (Full Width Edge-to-Edge) */}
      <div className="animate-landing-hero">
        <EditorialHeroGrid />
      </div>

      {/* About Us 3 Cards Showcase */}
      <div className="animate-landing-flashcard">
        <AboutSection />
      </div>

      {/* Standalone Final Section: '1 2 3 go kanya kanya na' CTA */}
      <section className="w-full border-t-2 border-slate-900/80 dark:border-white/30 bg-white dark:bg-[#0c0f1d] py-16 sm:py-24 animate-landing-cta">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white lowercase">
              1 2 3 go kanya kanya na
            </h2>
            <p className="text-base sm:text-xl font-bold text-slate-600 dark:text-slate-400">
              Shall we create?
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center">
            <Link
              href="/library"
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] px-10 py-4 sm:py-5 text-base sm:text-lg font-black uppercase tracking-wide text-white border-2 border-slate-900 shadow-brutal transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:scale-[0.98]"
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              <button onClick={() => setStarted(true)} disabled={started}>{started ? 'Setting up...' : 'Start'}</button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

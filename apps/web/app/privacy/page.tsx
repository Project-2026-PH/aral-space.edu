import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | Aral Space',
  description: 'Privacy Policy for Aral Space.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16 space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-900 bg-blue-600 text-white px-3 py-1 text-xs font-black uppercase tracking-wider shadow-brutal-sm">
          <Lock className="w-3.5 h-3.5" />
          Privacy & Data Protection
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Last updated: September 2026
        </p>
      </div>

      <div className="rounded-2xl border-2 border-slate-900 dark:border-white/30 bg-white dark:bg-[#101526] p-6 sm:p-8 shadow-brutal space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <section className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">1. Zero Mandatory Accounts</h2>
          <p>
            Aral Space does not require user accounts, emails, or phone numbers to create notes, flashcards, or reviewers. You can use the entire platform anonymously with complete privacy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">2. Local Storage Priority</h2>
          <p>
            Your question sets, flashcard ratings, and markdown files are stored in your device browser storage. Clearing your browser cache or site data will remove local items unless exported.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">3. Third-Party AI Processing</h2>
          <p>
            When utilizing AI generation features, pasted handout excerpts are processed transiently to output questions and are never used to train global models.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">4. Cookies and Telemetry</h2>
          <p>
            Aral Space uses only minimal, strictly functional client cookies (such as your chosen light/dark theme preference) without invasive ad-trackers.
          </p>
        </section>
      </div>
    </div>
  );
}

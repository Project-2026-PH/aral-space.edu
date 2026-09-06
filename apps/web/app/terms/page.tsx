import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | Aral Space',
  description: 'Terms of Service for Aral Space.',
};

export default function TermsPage() {
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
          <ShieldCheck className="w-3.5 h-3.5" />
          Legal & Guidelines
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Terms of Service
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Last updated: September 2026
        </p>
      </div>

      <div className="rounded-2xl border-2 border-slate-900 dark:border-white/30 bg-white dark:bg-[#101526] p-6 sm:p-8 shadow-brutal space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <section className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">1. Local-First Architecture</h2>
          <p>
            Aral Space operates as a client-first, offline-capable study platform. Your reviewer decks, flashcards, notes, and study sets are stored directly on your local device browser storage (IndexedDB/LocalStorage) unless you explicitly use peer collaboration tokens.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">2. Acceptable Use</h2>
          <p>
            You agree to use Aral Space solely for legitimate academic and personal study purposes. You retain full ownership of any notes, lecture handouts, and content you paste or process in the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">3. AI Generated Content</h2>
          <p>
            AI reviewers, active recall cards, and smart distractor questions are generated to assist study recall. Always cross-reference generated cards with your original course materials before academic examinations.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">4. Peer Sharing & Collaboration</h2>
          <p>
            When sharing reviewer tokens with peers, you control who has access to your shared reviewer link. Shared sets are cloned directly to your peer’s local storage.
          </p>
        </section>
      </div>
    </div>
  );
}

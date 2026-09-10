import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | Aral Space',
  description: 'Privacy Policy for Aral Space - Zero-Account Study Architecture.',
};

export default function PrivacyPage() {
  return (
    <div className="w-full bg-[#fafafa] dark:bg-[#0c0f1d] min-h-[calc(100vh-4rem)] border-b-2 border-slate-900/80 dark:border-white/30">
      <div className="relative grid grid-cols-1 lg:grid-cols-12 w-full">
        {/* ================= LEFT COLUMN: EDITORIAL BANNER ================= */}
        <div className="lg:col-span-5 flex flex-col justify-between border-b-2 lg:border-b-0 lg:border-r-2 border-slate-900/80 dark:border-white/30 bg-white dark:bg-[#0c0f1d] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]">
          {/* Top Info */}
          <div className="p-8 sm:p-12 lg:p-14 flex-1 flex flex-col justify-center space-y-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>

            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-900 bg-blue-600 text-white px-3.5 py-1 text-xs font-black uppercase tracking-wider shadow-brutal-sm">
                <Lock className="w-3.5 h-3.5" />
                Privacy & Data Protection
              </span>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.08]">
                Privacy<br />Policy
              </h1>
            </div>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Quiz Creator is designed with a <strong className="text-slate-900 dark:text-white font-bold">privacy-first, zero-account architecture</strong>. Study effectively without sacrificing your personal information.
            </p>

            <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-white/10 space-y-1">
              <div>EFFECTIVE: September 7, 2026</div>
              <div>LAST UPDATED: September 7, 2026</div>
            </div>
          </div>

          {/* Bottom 3 Cells (Matching Hero Grid) */}
          <div className="grid grid-cols-3 border-t-2 border-slate-900/80 dark:border-white/30 divide-x-2 divide-slate-900/80 dark:divide-white/30 bg-white dark:bg-[#101526]">
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <span className="block text-base font-black text-blue-600 dark:text-blue-400 mb-0.5">1</span>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                  Zero accounts required.
                </p>
              </div>
              <div className="w-full h-0.5 bg-slate-900/20 dark:bg-white/20 mt-2" />
            </div>

            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <span className="block text-base font-black text-blue-600 dark:text-blue-400 mb-0.5">2</span>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                  Everything stays on device.
                </p>
              </div>
              <div className="w-full h-0.5 bg-slate-900/20 dark:bg-white/20 mt-2" />
            </div>

            <div className="p-4 sm:p-5 flex items-center justify-between">
              <div className="w-9 h-12 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center shadow-brutal-xs">
                <span className="text-lg font-black text-white">A</span>
              </div>
              <span className="text-[9px] font-mono font-bold tracking-widest text-slate-600 dark:text-slate-400 rotate-90 origin-center whitespace-nowrap">
                © 2026/ARAL///
              </span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: DOCUMENT BODY ================= */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-14 space-y-8 max-w-3xl">
          <div className="rounded-3xl border-3 border-slate-900 dark:border-white/30 bg-white dark:bg-[#101526] p-6 sm:p-10 shadow-brutal space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                1. Information We Do Not Collect
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 font-medium">
                <li>We <strong>do not</strong> require or collect names, email addresses, phone numbers, or passwords.</li>
                <li>We <strong>do not</strong> use third-party tracking scripts, cross-site trackers, or advertising pixels.</li>
                <li>We <strong>do not</strong> sell, monetize, or rent any user data or study content to third parties.</li>
                <li>We <strong>do not</strong> associate your study materials with a real-world identity.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                2. Information We Collect and How It Is Handled
              </h2>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">A. Anonymous Session Identity</h3>
                <p>
                  To persist your quizzes and spaced-repetition progress across visits, our server automatically issues a cryptographically signed anonymous identifier:
                </p>
                <ul className="list-disc pl-5 space-y-1 font-medium">
                  <li><strong>Identifier Format:</strong> <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">anon_&lt;UUID&gt;</code> (e.g., <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">anon_12345678-abcd-...</code>).</li>
                  <li><strong>Cookie Storage:</strong> Saved as an <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">HttpOnly</code>, <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">SameSite=Lax</code>, <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">Secure</code> cookie named <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">quizmaster_anon_id</code>.</li>
                  <li><strong>Lifespan:</strong> 30 days from your last active visit.</li>
                  <li><strong>Purpose:</strong> Associates your created quizzes, study decks, and spaced-repetition progress with your browser session.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">B. User-Generated Study Content</h3>
                <ul className="list-disc pl-5 space-y-1.5 font-medium">
                  <li><strong>Quizzes and Reviewers:</strong> When you explicitly save a quiz, the title, questions, options, answers, and pedagogical explanations are stored in our secure database linked solely to your anonymous user ID.</li>
                  <li><strong>Notes and Drafts:</strong> Content created in the Notes Workspace is saved <strong>locally on your device</strong> in your browser&apos;s <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">localStorage</code>. Notes are never uploaded to our servers unless you explicitly click <strong>Save as -&gt; Reviewer</strong>.</li>
                  <li><strong>Spaced-Repetition Progress:</strong> Your Leitner queue state, streak counts, struggle-pile records, and question mastery intervals are saved to our database under your anonymous ID. Local practice session snapshots are cached in your browser for 24 hours; free-form typed answers are stripped from snapshots to prevent storing raw keystrokes.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">C. Aggregate Authoring Preferences</h3>
                <p>
                  To adapt AI question generation to your preferred style (e.g., preferred question length or multiple-choice formats):
                </p>
                <ul className="list-disc pl-5 space-y-1.5 font-medium">
                  <li>The platform records <strong>strictly bounded numeric averages and event counters</strong> in your browser&apos;s <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">localStorage</code> (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">quiz-creator:authoring-preferences:v1</code>).</li>
                  <li>This data includes counts of creates/edits/deletes, question types, and average character lengths.</li>
                  <li><strong>Privacy Boundary:</strong> Question prompts, correct answers, distractor text, explanations, and uploaded files are <strong>never</strong> stored in or transmitted as part of authoring preferences.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">D. AI Generation and Processing</h3>
                <ul className="list-disc pl-5 space-y-1.5 font-medium">
                  <li>When you use AI generation features (Gemini or Groq pipelines), the text you submit is transmitted via encrypted HTTPS to Google Gemini or Groq APIs solely to generate quiz questions.</li>
                  <li>If you use the <strong>Local Generator</strong> or <strong>Notes Reviewer Builder</strong>, question extraction is executed deterministically without contacting any external AI provider.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">E. Spelling and Grammar Checking</h3>
                <p className="font-medium">
                  Text entered in the Notes Workspace is processed via an internal endpoint (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">/api/grammar-check</code>) using local rule-based checking. Text sent to this service is evaluated entirely in volatile memory and is never logged, saved to disk, or retained.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                3. Cross-Device Syncing Without Accounts
              </h2>
              <p>
                If you wish to access your quizzes on another device (e.g., moving from laptop to mobile):
              </p>
              <ul className="list-disc pl-5 space-y-1.5 font-medium">
                <li>You may generate an <strong>Anonymous Device Pairing Code</strong> consisting of a 4-character Sync ID and a 6-digit PIN.</li>
                <li>The server stores only a SHA-256 cryptographic hash of the PIN in the <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">anonymous_pairing_tickets</code> table with a strict <strong>10-minute expiration</strong> and a maximum of 5 attempts.</li>
                <li>Upon successful redemption, ownership of your quizzes and sessions is transferred atomically to your new device. Pairing tickets are permanently deleted immediately upon use.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                4. Data Retention and Deletion
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 font-medium">
                <li><strong>Local Data:</strong> You may delete all local notes, drafts, and preferences at any time by clearing your browser&apos;s site data or <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">localStorage</code> for our domain.</li>
                <li><strong>Anonymous Sessions:</strong> Quizzes and sessions tied to an anonymous ID remain stored in the database. If you clear your cookies, you forfeit access to that anonymous session unless you have paired it with another device or exported your data.</li>
                <li><strong>Data Portability:</strong> You can export any quiz at any time in <strong>JSON</strong>, <strong>CSV</strong>, or <strong>PDF</strong> format via the quiz export menu.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                5. Security Safeguards
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 font-medium">
                <li><strong>Transport Encryption:</strong> All traffic is encrypted in transit using Transport Layer Security (TLS 1.3).</li>
                <li><strong>Cryptographic Signatures:</strong> Anonymous session cookies are signed with HMAC-SHA256 to prevent spoofing or tampering.</li>
                <li><strong>Rate Limiting:</strong> Distributed rate-limiting mitigates automated scraping and denial-of-service attempts.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

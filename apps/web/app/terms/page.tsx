import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Terms and Conditions | Quiz Creator',
  description: 'Terms and Conditions of Use for Quiz Creator platform.',
};

export default function TermsPage() {
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
                <ShieldCheck className="w-3.5 h-3.5" />
                Legal & Terms of Use
              </span>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.08]">
                Terms &<br />Conditions
              </h1>
            </div>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Please read these Terms and Conditions carefully before using the Quiz Creator platform. By accessing or using our website, APIs, or applications, you agree to be bound by these Terms.
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
                  Educational & study use.
                </p>
              </div>
              <div className="w-full h-0.5 bg-slate-900/20 dark:bg-white/20 mt-2" />
            </div>

            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <span className="block text-base font-black text-blue-600 dark:text-blue-400 mb-0.5">2</span>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                  You own your content & notes.
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
                1. Description of the Service
              </h2>
              <p>Quiz Creator is a standalone, local-first learning platform providing:</p>
              <ul className="list-disc pl-5 space-y-1.5 font-medium">
                <li>Notes authoring and rich-text editing.</li>
                <li>Deterministic and AI-assisted quiz, flashcard, and reviewer generation.</li>
                <li>Spaced-repetition mastery tracking based on cognitive retention curves.</li>
                <li>Anonymous device-to-device session syncing.</li>
              </ul>
              <p className="font-medium pt-1">
                The Service is provided free of charge or as open-source software for personal, educational, and non-commercial study use.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                2. Anonymous Access and Account Responsibility
              </h2>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">A. No Account Recovery</h3>
                <p>
                  The Service operates without email, password, or OAuth authentication. Your library and progress are associated exclusively with an anonymous session identifier (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">quizmaster_anon_id</code>) stored in your browser cookie and local data in <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">localStorage</code>.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">B. User Responsibility for Data Preservation</h3>
                <p>
                  Because we do not collect personal identifiers, <strong>we cannot recover lost sessions, forgotten tokens, or deleted local notes</strong>. You are solely responsible for:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 font-medium">
                  <li>Exporting vital study decks via the <strong>Export</strong> feature (JSON, CSV, or PDF).</li>
                  <li>Generating an <strong>Anonymous Pairing Code</strong> before clearing your browser cookies or switching devices.</li>
                  <li>Backing up important notes created in the local Notes Workspace.</li>
                </ul>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                3. User Content and Intellectual Property
              </h2>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">A. Ownership of Your Materials</h3>
                <p>
                  You retain full ownership of all notes, questions, uploaded documents, handouts, and study materials you input or generate through the Service. We assert no intellectual property rights over your content.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">B. Uploads and Copyright Compliance</h3>
                <p>
                  You represent and warrant that you own or hold the necessary licenses, rights, and permissions to paste, upload, or process any lecture handouts, PDFs, syllabus excerpts, or textbooks. You agree not to upload materials that infringe on third-party copyrights, trademarks, or trade secrets.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">C. Public Quizzes and Share Tokens</h3>
                <p>If you enable public sharing or generate a share link for a quiz or subject:</p>
                <ul className="list-disc pl-5 space-y-1 font-medium">
                  <li>You grant recipients a non-exclusive license to view, study, and clone that quiz deck.</li>
                  <li>You acknowledge that anyone with the unique share token may access the title, questions, answers, and explanations contained within that deck.</li>
                  <li>You must not share proprietary exams, confidential corporate documents, or private personal information.</li>
                </ul>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                4. AI-Generated Content Disclaimer
              </h2>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">A. Pedagogical Assistance, Not Ground Truth</h3>
                <p>
                  The Service offers question generation powered by Large Language Models (including Google Gemini and Groq Llama-3) as well as deterministic algorithmic parsers.
                </p>
                <ul className="list-disc pl-5 space-y-1 font-medium">
                  <li>AI models can make mistakes, hallucinate answers, generate inaccurate distractors, or misinterpret nuances in complex source texts.</li>
                  <li><strong>You are solely responsible for verifying the factual correctness of generated questions</strong> before using them for high-stakes examinations, certifications, or coursework.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">B. Academic Integrity</h3>
                <p>
                  The Service is intended strictly as a study aid and self-assessment tool. You agree not to use the Service in violation of your academic institution&apos;s code of conduct, honor code, or anti-cheating policies.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                5. Acceptable Use Policy
              </h2>
              <p>When using the Service, you agree <strong>not</strong> to:</p>
              <ol className="list-decimal pl-5 space-y-2 font-medium">
                <li><strong>Abuse Infrastructure:</strong> Circumvent, probe, or attempt to disable security controls, cryptographic token signatures, or rate-limiting thresholds (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">security_rate_limits</code>).</li>
                <li><strong>Automate or Scrape:</strong> Use bots, scrapers, or automated tools to extract questions or bombard the generation endpoints without prior authorization.</li>
                <li><strong>Attack Pairing Endpoints:</strong> Attempt to brute-force 6-digit device-pairing codes (pairing tickets are strictly capped at 5 attempts and expire in 10 minutes).</li>
                <li><strong>Distribute Malicious Content:</strong> Submit malicious code, scripts, phishing URLs, or payloads designed to compromise client browsers or backend execution.</li>
                <li><strong>Transmit Prohibited Materials:</strong> Submit unlawful, defamatory, obscene, harassing, or sexually explicit content.</li>
              </ol>
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 pt-1">
                We reserve the right to temporarily or permanently block IP addresses or anonymous IDs violating this policy.
              </p>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                6. Service Availability and Modifications
              </h2>
              <p>The Service is provided on an <strong>&ldquo;AS IS&rdquo;</strong> and <strong>&ldquo;AS AVAILABLE&rdquo;</strong> basis. We reserve the right to:</p>
              <ul className="list-disc pl-5 space-y-1.5 font-medium">
                <li>Modify, update, or discontinue features (including AI pipeline configurations and database schemas) at any time without notice.</li>
                <li>Implement storage size restrictions, page limits, and rate limits on generation requests as detailed in technical specifications.</li>
                <li>Clean up expired ephemeral pairing tickets, obsolete session caches, or inactive anonymous records.</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                7. Disclaimer of Warranties
              </h2>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs uppercase font-mono space-y-2 leading-relaxed">
                <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>THE SERVICE IS PROVIDED WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</li>
                  <li>WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, ERROR-FREE, OR FREE OF DATA LOSS.</li>
                  <li>WE DISCLAIM ANY LIABILITY FOR ACADEMIC OUTCOMES, EXAM GRADES, OR RETENTION PERFORMANCE RESULTING FROM THE USE OF THE SERVICE.</li>
                </ul>
              </div>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                8. Limitation of Liability
              </h2>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs uppercase font-mono leading-relaxed">
                IN NO EVENT SHALL THE AUTHORS, MAINTAINERS, OR HOSTING OPERATORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, STUDY PROGRESS, REVENUE, OR ACADEMIC STANDING, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE THE SERVICE.
              </div>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                9. Changes to Terms
              </h2>
              <p>
                We may update these Terms periodically. Continued use of the platform after updates constitutes acceptance of the revised Terms.
              </p>
            </section>

            {/* Section 10 */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-white border-b-2 border-slate-900/15 dark:border-white/15 pb-2">
                10. Contact
              </h2>
              <p>
                For technical questions or legal inquiries, refer to the repository documentation or project source repository.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

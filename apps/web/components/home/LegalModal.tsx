'use client';

import React, { useState } from 'react';
import { X, Lock, ShieldCheck } from 'lucide-react';

export default function LegalModal() {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setActiveTab(null);
      setIsClosing(false);
    }, 200);
  };

  const handleOpen = (tab: 'privacy' | 'terms') => {
    setIsClosing(false);
    setActiveTab(tab);
  };

  return (
    <>
      {/* Footer trigger buttons */}
      <div className="flex items-center gap-6 text-xs font-bold text-slate-600 dark:text-slate-400">
        <button
          type="button"
          onClick={() => handleOpen('terms')}
          className="hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-4 decoration-slate-300 dark:decoration-slate-700 transition-colors cursor-pointer"
        >
          Terms of Service
        </button>
        <button
          type="button"
          onClick={() => handleOpen('privacy')}
          className="hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-4 decoration-slate-300 dark:decoration-slate-700 transition-colors cursor-pointer"
        >
          Privacy Policy
        </button>
      </div>

      {/* Smooth Modal Dialog */}
      {activeTab && (
        <div
          onClick={handleClose}
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/65 backdrop-blur-xs overflow-y-auto ${
            isClosing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'
          }`}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-4xl max-h-[88vh] rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-[#0c0f1d] shadow-brutal flex flex-col overflow-hidden text-slate-900 dark:text-white my-auto ${
              isClosing ? 'animate-modal-pop-out' : 'animate-modal-pop'
            } will-change-transform`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900/15 dark:border-white/15 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('terms')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
                    activeTab === 'terms'
                      ? 'bg-blue-600 text-white border-slate-900 shadow-brutal-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:border-slate-300'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Terms of Service
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('privacy')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
                    activeTab === 'privacy'
                      ? 'bg-blue-600 text-white border-slate-900 shadow-brutal-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:border-slate-300'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Privacy Policy
                </button>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Close dialog"
                className="rounded-xl p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body with FULL text content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300 select-text">
              {activeTab === 'terms' ? (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 dark:border-white/10 pb-4">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      Terms and Conditions of Use
                    </h2>
                    <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-1">
                      EFFECTIVE: September 7, 2026 • LAST UPDATED: September 7, 2026
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-2 leading-relaxed">
                      Please read these Terms and Conditions (&ldquo;Terms&rdquo;) carefully before using the Quiz Creator platform (&ldquo;Service&rdquo;, &ldquo;Application&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;). By accessing or using our website, APIs, or mobile applications, you agree to be bound by these Terms. If you do not agree, do not use the Service.
                    </p>
                  </div>

                  {/* Section 1 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">1. Description of the Service</h3>
                    <p>Quiz Creator is a standalone, local-first learning platform providing:</p>
                    <ul className="list-disc pl-5 space-y-1 font-medium">
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
                  <section className="space-y-3">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">2. Anonymous Access and Account Responsibility</h3>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">A. No Account Recovery</h4>
                      <p>
                        The Service operates without email, password, or OAuth authentication. Your library and progress are associated exclusively with an anonymous session identifier (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">quizmaster_anon_id</code>) stored in your browser cookie and local data in <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">localStorage</code>.
                      </p>
                    </div>
                    <div className="space-y-1 pt-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">B. User Responsibility for Data Preservation</h4>
                      <p>
                        Because we do not collect personal identifiers, <strong>we cannot recover lost sessions, forgotten tokens, or deleted local notes</strong>. You are solely responsible for:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 font-medium">
                        <li>Exporting vital study decks via the <strong>Export</strong> feature (JSON, CSV, or PDF).</li>
                        <li>Generating an <strong>Anonymous Pairing Code</strong> before clearing your browser cookies or switching devices.</li>
                        <li>Backing up important notes created in the local Notes Workspace.</li>
                      </ul>
                    </div>
                  </section>

                  {/* Section 3 */}
                  <section className="space-y-3">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">3. User Content and Intellectual Property</h3>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">A. Ownership of Your Materials</h4>
                      <p>
                        You retain full ownership of all notes, questions, uploaded documents, handouts, and study materials you input or generate through the Service. We assert no intellectual property rights over your content.
                      </p>
                    </div>
                    <div className="space-y-1 pt-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">B. Uploads and Copyright Compliance</h4>
                      <p>
                        You represent and warrant that you own or hold the necessary licenses, rights, and permissions to paste, upload, or process any lecture handouts, PDFs, syllabus excerpts, or textbooks. You agree not to upload materials that infringe on third-party copyrights, trademarks, or trade secrets.
                      </p>
                    </div>
                    <div className="space-y-1 pt-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">C. Public Quizzes and Share Tokens</h4>
                      <p>If you enable public sharing or generate a share link for a quiz or subject:</p>
                      <ul className="list-disc pl-5 space-y-1 font-medium">
                        <li>You grant recipients a non-exclusive license to view, study, and clone that quiz deck.</li>
                        <li>You acknowledge that anyone with the unique share token may access the title, questions, answers, and explanations contained within that deck.</li>
                        <li>You must not share proprietary exams, confidential corporate documents, or private personal information.</li>
                      </ul>
                    </div>
                  </section>

                  {/* Section 4 */}
                  <section className="space-y-3">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">4. AI-Generated Content Disclaimer</h3>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">A. Pedagogical Assistance, Not Ground Truth</h4>
                      <p>
                        The Service offers question generation powered by Large Language Models (including Google Gemini and Groq Llama-3) as well as deterministic algorithmic parsers.
                      </p>
                      <ul className="list-disc pl-5 space-y-1 font-medium">
                        <li>AI models can make mistakes, hallucinate answers, generate inaccurate distractors, or misinterpret nuances in complex source texts.</li>
                        <li><strong>You are solely responsible for verifying the factual correctness of generated questions</strong> before using them for high-stakes examinations, certifications, or coursework.</li>
                      </ul>
                    </div>
                    <div className="space-y-1 pt-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">B. Academic Integrity</h4>
                      <p>
                        The Service is intended strictly as a study aid and self-assessment tool. You agree not to use the Service in violation of your academic institution&apos;s code of conduct, honor code, or anti-cheating policies.
                      </p>
                    </div>
                  </section>

                  {/* Section 5 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">5. Acceptable Use Policy</h3>
                    <p>When using the Service, you agree <strong>not</strong> to:</p>
                    <ol className="list-decimal pl-5 space-y-1.5 font-medium">
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
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">6. Service Availability and Modifications</h3>
                    <p>The Service is provided on an <strong>&ldquo;AS IS&rdquo;</strong> and <strong>&ldquo;AS AVAILABLE&rdquo;</strong> basis. We reserve the right to:</p>
                    <ul className="list-disc pl-5 space-y-1 font-medium">
                      <li>Modify, update, or discontinue features (including AI pipeline configurations and database schemas) at any time without notice.</li>
                      <li>Implement storage size restrictions, page limits, and rate limits on generation requests as detailed in technical specifications.</li>
                      <li>Clean up expired ephemeral pairing tickets, obsolete session caches, or inactive anonymous records.</li>
                    </ul>
                  </section>

                  {/* Section 7 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">7. Disclaimer of Warranties</h3>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs uppercase font-mono space-y-1.5 leading-relaxed">
                      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>THE SERVICE IS PROVIDED WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</li>
                        <li>WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, ERROR-FREE, OR FREE OF DATA LOSS.</li>
                        <li>WE DISCLAIM ANY LIABILITY FOR ACADEMIC OUTCOMES, EXAM GRADES, OR RETENTION PERFORMANCE RESULTING FROM THE USE OF THE SERVICE.</li>
                      </ul>
                    </div>
                  </section>

                  {/* Section 8 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">8. Limitation of Liability</h3>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs uppercase font-mono leading-relaxed">
                      IN NO EVENT SHALL THE AUTHORS, MAINTAINERS, OR HOSTING OPERATORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, STUDY PROGRESS, REVENUE, OR ACADEMIC STANDING, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE THE SERVICE.
                    </div>
                  </section>

                  {/* Section 9 & 10 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">9. Changes to Terms</h3>
                    <p>
                      We may update these Terms periodically. Continued use of the platform after updates constitutes acceptance of the revised Terms.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">10. Contact</h3>
                    <p>
                      For technical questions or legal inquiries, refer to the repository documentation or project source repository.
                    </p>
                  </section>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 dark:border-white/10 pb-4">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      Privacy Policy
                    </h2>
                    <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-1">
                      EFFECTIVE: September 7, 2026 • LAST UPDATED: September 7, 2026
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-2 leading-relaxed">
                      Quiz Creator (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the platform&rdquo;) is designed with a <strong className="text-slate-900 dark:text-white font-bold">privacy-first, zero-account architecture</strong>. We believe you should be able to create notes, study effectively, and master content without sacrificing your personal privacy or surrendering personal information.
                    </p>
                  </div>

                  {/* Section 1 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">1. Information We Do Not Collect</h3>
                    <ul className="list-disc pl-5 space-y-1 font-medium">
                      <li>We <strong>do not</strong> require or collect names, email addresses, phone numbers, or passwords.</li>
                      <li>We <strong>do not</strong> use third-party tracking scripts, cross-site trackers, or advertising pixels.</li>
                      <li>We <strong>do not</strong> sell, monetize, or rent any user data or study content to third parties.</li>
                      <li>We <strong>do not</strong> associate your study materials with a real-world identity.</li>
                    </ul>
                  </section>

                  {/* Section 2 */}
                  <section className="space-y-3">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">2. Information We Collect and How It Is Handled</h3>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">A. Anonymous Session Identity</h4>
                      <p>
                        To persist your quizzes and spaced-repetition progress across visits, our server automatically issues a cryptographically signed anonymous identifier:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 font-medium">
                        <li><strong>Identifier Format:</strong> <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">anon_&lt;UUID&gt;</code>.</li>
                        <li><strong>Cookie Storage:</strong> Saved as an <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">HttpOnly</code>, <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">SameSite=Lax</code>, <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">Secure</code> cookie named <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">quizmaster_anon_id</code>.</li>
                        <li><strong>Lifespan:</strong> 30 days from your last active visit.</li>
                        <li><strong>Purpose:</strong> Associates your created quizzes, study decks, and spaced-repetition progress with your browser session.</li>
                      </ul>
                    </div>

                    <div className="space-y-1 pt-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">B. User-Generated Study Content</h4>
                      <ul className="list-disc pl-5 space-y-1 font-medium">
                        <li><strong>Quizzes and Reviewers:</strong> Stored in our secure database linked solely to your anonymous user ID.</li>
                        <li><strong>Notes and Drafts:</strong> Saved <strong>locally on your device</strong> in your browser&apos;s <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">localStorage</code>. Notes are never uploaded to our servers unless you click <strong>Save as -&gt; Reviewer</strong>.</li>
                        <li><strong>Spaced-Repetition Progress:</strong> Saved under your anonymous ID. Local practice session snapshots are cached for 24 hours; free-form typed answers are stripped.</li>
                      </ul>
                    </div>

                    <div className="space-y-1 pt-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">C. Aggregate Authoring Preferences</h4>
                      <p>
                        The platform records strictly bounded numeric averages and event counters in your browser&apos;s <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">localStorage</code> (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">quiz-creator:authoring-preferences:v1</code>). Question prompts, correct answers, and uploaded files are <strong>never</strong> transmitted.
                      </p>
                    </div>

                    <div className="space-y-1 pt-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">D. AI Generation and Processing</h4>
                      <p>
                        When you use AI generation features, text is transmitted via encrypted HTTPS solely to generate questions. Local generation features run deterministically without contacting any external AI provider.
                      </p>
                    </div>

                    <div className="space-y-1 pt-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">E. Spelling and Grammar Checking</h4>
                      <p>
                        Processed via local rule-based checking in volatile memory and is never logged, saved to disk, or retained.
                      </p>
                    </div>
                  </section>

                  {/* Section 3 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">3. Cross-Device Syncing Without Accounts</h3>
                    <p>
                      Anonymous Device Pairing Codes use a 10-minute expiration and a maximum of 5 attempts. Codes are stored as SHA-256 cryptographic hashes and permanently deleted immediately upon redemption.
                    </p>
                  </section>

                  {/* Section 4 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">4. Data Retention and Deletion</h3>
                    <p>
                      You may delete all local notes, drafts, and preferences at any time by clearing your browser&apos;s site data or <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">localStorage</code>. Quizzes can be exported anytime via JSON, CSV, or PDF.
                    </p>
                  </section>

                  {/* Section 5 */}
                  <section className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">5. Security Safeguards</h3>
                    <ul className="list-disc pl-5 space-y-1 font-medium">
                      <li><strong>Transport Encryption:</strong> All traffic encrypted using TLS 1.3.</li>
                      <li><strong>Cryptographic Signatures:</strong> Anonymous session cookies signed with HMAC-SHA256.</li>
                      <li><strong>Rate Limiting:</strong> Distributed rate-limiting mitigates automated scraping and abuse.</li>
                    </ul>
                  </section>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t-2 border-slate-900/15 dark:border-white/15 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Aral Space • Privacy-First Architecture
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-black text-xs uppercase tracking-wider border-2 border-slate-900 shadow-brutal-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

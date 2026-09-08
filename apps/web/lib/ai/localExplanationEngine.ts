import { getExplanationPromptModifiers } from './explanationPreferences';

export interface LocalExplanationQuestionContext {
  id: string;
  question_text: string;
  answer_text?: string | null;
  options?: string[];
  correct_answer?: number | null;
  correct_explanation?: string | null;
  explanation?: string | null;
}

export interface LocalExplanationRequest {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  wrongAnswer: string;
  guestId?: string | null;
  correctExplanation?: string | null;
  distractorExplanation?: string | null;
  /** Other questions in the designated quiz set, used for trusted contrastive evidence. */
  questionSet?: LocalExplanationQuestionContext[];
}

export interface LocalExplanationResult {
  explanation: string;
  isAiGenerated: boolean;
  latencyMs: number;
  motivationalStim?: string;
}

export const FILIPINO_MOTIVATIONAL_STIMS = [
  'Eyyy, bawi next card!',
  "Sheesh, kaya pa 'yan!",
  'Mindset ba, mindset!',
  'Goods lang, bawi agad!',
  'Aray beh, pero laban!',
  'Chill lang, bounce back tayo!',
  'Dikit na, isa pa!',
  'G lang, tuloy ang aral!',
  "Huy teka, kaya mo 'to!",
  'Padayon, babawi tayo!',
  'Kering-keri, bawi ka!',
  'Tuloy lang ang grind!',
];

export function getRandomMotivationalStim(): string {
  return FILIPINO_MOTIVATIONAL_STIMS[
    Math.floor(Math.random() * FILIPINO_MOTIVATIONAL_STIMS.length)
  ];
}

// ---------------------------------------------------------------------------
// Model configuration
// ---------------------------------------------------------------------------
// An encoder-decoder (seq2seq) model. For grounded paraphrase ("rewrite this
// text, add nothing") that is structurally safer than a causal LM, because the
// source text sits in the encoder instead of competing with instructions in a
// prompt.
//
// Model choice was measured, not assumed. On the actual task:
//   Xenova/flan-t5-small        (95MB,  Apache-2.0) -- unusable: either copies the
//                                source verbatim or fabricates ("The Privacy Act of 1999").
//   Xenova/flan-t5-base         (275MB, Apache-2.0) -- unusable: collapses to
//                                fragments like "the cell" / "kinetic energy".
//   onnx-community/Qwen2.5-0.5B (512MB, Apache-2.0) -- unusable at q8: int8
//                                quantization breaks Qwen2 activation outliers, and
//                                wasm decoding took 10-16s per call.
//   Xenova/LaMini-Flan-T5-248M  (275MB, CC-BY-NC-4.0) -- the only one that produced
//                                grounded, well-formed sentences in ~300-500ms.
//
// !! LICENSING: LaMini-Flan-T5-248M is CC-BY-NC-4.0 (NON-COMMERCIAL). It is fine
// !! for research/personal use. If this app is ever monetised, swap MODEL_ID to an
// !! Apache-2.0 model and re-run the quality check -- the grounding gate below will
// !! degrade to the reference template rather than emit hallucinations, so a worse
// !! model is safe, just less useful.
//
// Sizes at q8: encoder 110.5MB + merged decoder 164.7MB.
const MODEL_ID = 'Xenova/LaMini-Flan-T5-248M';
const MODEL_TASK = 'text2text-generation' as const;
const MODEL_DTYPE = 'q8' as const;

const MIN_LOADING_DURATION_MS = 1500;
// WebGPU may compile the quantized graph on the first generation even after the
// pipeline reports ready. The observed first generation took ~21s, so 10s was
// guaranteed to return the fallback before validation could finish.
const COLD_START_TIMEOUT_MS = 45000;
const WARM_TIMEOUT_MS = 30000;

// The model only writes sentence 1. The template owns sentence 2 and all
// structure, so truncation is no longer a structural failure mode.
const MAX_SENTENCE_TOKENS = 48;
const MIN_SLOT_WORDS = 3;
const MAX_SLOT_WORDS = 28;
// Share of long words in the generated sentence that must trace back to source.
const MIN_GROUNDED_RATIO = 0.5;

// ---------------------------------------------------------------------------
// Debug instrumentation
// ---------------------------------------------------------------------------

export type LocalAiStatus = 'idle' | 'loading' | 'downloading' | 'ready' | 'error';

interface LocalAiFileProgress {
  file: string;
  loaded: number;
  total: number;
  progress: number;
}

export interface LocalAiDebugState {
  status: LocalAiStatus;
  modelId: string;
  task: string;
  dtype: string;
  device: string | null;
  webGpuAvailable: boolean | null;
  files: Record<string, LocalAiFileProgress>;
  downloadedBytes: number;
  totalBytes: number;
  overallProgressPct: number;
  servedFromCache: boolean | null;
  loadStartedAt: number | null;
  readyAt: number | null;
  loadDurationMs: number | null;
  lastError: string | null;
  generationCount: number;
  aiSuccessCount: number;
  fallbackCount: number;
  cacheHitCount: number;
  lastFallbackReason: string | null;
}

const LOG_PREFIX = '[LocalAI]';

const debugState: LocalAiDebugState = {
  status: 'idle',
  modelId: MODEL_ID,
  task: MODEL_TASK,
  dtype: MODEL_DTYPE,
  device: null,
  webGpuAvailable: null,
  files: {},
  downloadedBytes: 0,
  totalBytes: 0,
  overallProgressPct: 0,
  servedFromCache: null,
  loadStartedAt: null,
  readyAt: null,
  loadDurationMs: null,
  lastError: null,
  generationCount: 0,
  aiSuccessCount: 0,
  fallbackCount: 0,
  cacheHitCount: 0,
  lastFallbackReason: null,
};

function log(...args: unknown[]): void {
  console.log(LOG_PREFIX, ...args);
}

function warn(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function getLocalAiDebugState(): LocalAiDebugState {
  return { ...debugState, files: { ...debugState.files } };
}

/**
 * Prints a full snapshot of the engine state. Called automatically at the start
 * of every explanation request, so clicking "Explain with AI" always shows
 * whether the model is idle, downloading, ready, or failed.
 */
export function logLocalAiState(context: string): void {
  const state = getLocalAiDebugState();
  const files = Object.values(state.files);

  console.groupCollapsed(
    `${LOG_PREFIX} ${context} | status=${state.status} progress=${state.overallProgressPct}% device=${state.device ?? 'not-selected'}`
  );
  log('model        :', state.modelId, `(task=${state.task}, dtype=${state.dtype})`);
  log('device       :', state.device ?? 'not selected yet', `| webgpu available: ${state.webGpuAvailable}`);
  log('status       :', state.status);

  if (state.status === 'ready') {
    log(
      'load         :',
      `${state.loadDurationMs}ms`,
      state.servedFromCache
        ? '(served from browser cache; pipeline initialization only)'
        : `(downloaded ${formatMb(state.downloadedBytes)} during pipeline initialization; not re-downloaded per explanation)`
    );
  } else if (state.status === 'downloading') {
    log('download     :', `${state.overallProgressPct}%`, `${formatMb(state.downloadedBytes)} / ${formatMb(state.totalBytes)}`);
  } else if (state.status === 'loading') {
    const elapsed = state.loadStartedAt ? Date.now() - state.loadStartedAt : 0;
    log('load         :', `in progress, ${elapsed}ms elapsed, no download events yet`);
  } else if (state.status === 'error') {
    warn('lastError    :', state.lastError);
  } else {
    log('load         :', 'never started (prewarm has not run yet)');
  }

  if (files.length > 0) {
    console.table(
      files.map((f) => ({
        file: f.file,
        loaded: formatMb(f.loaded),
        total: formatMb(f.total),
        pct: `${Math.round(f.progress)}%`,
      }))
    );
  }

  log(
    'counters     :',
    `requests=${state.generationCount}`,
    `ai=${state.aiSuccessCount}`,
    `fallback=${state.fallbackCount}`,
    `cacheHits=${state.cacheHitCount}`
  );
  if (state.lastFallbackReason) {
    log('lastFallback :', state.lastFallbackReason);
  }
  log('tip          : call window.__localAiDebug() in the console for the raw snapshot');
  console.groupEnd();
}

function publishDebugHandle(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>).__localAiDebug = getLocalAiDebugState;
}

function recomputeTotals(): void {
  let loaded = 0;
  let total = 0;
  for (const file of Object.values(debugState.files)) {
    loaded += file.loaded;
    total += file.total;
  }
  debugState.downloadedBytes = loaded;
  debugState.totalBytes = total;
  debugState.overallProgressPct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
}

let lastLoggedProgressPct = -1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleModelProgress(event: any): void {
  if (!event || typeof event !== 'object') return;

  const status = String(event.status ?? '');
  const file = String(event.file ?? event.name ?? 'unknown');

  switch (status) {
    case 'initiate':
      debugState.status = 'downloading';
      debugState.files[file] = { file, loaded: 0, total: Number(event.total) || 0, progress: 0 };
      log(`download start  -> ${file}`);
      break;

    case 'download':
      debugState.status = 'downloading';
      break;

    case 'progress': {
      debugState.status = 'downloading';
      debugState.files[file] = {
        file,
        loaded: Number(event.loaded) || 0,
        total: Number(event.total) || 0,
        progress: Number(event.progress) || 0,
      };
      recomputeTotals();
      const pct = debugState.overallProgressPct;
      if (pct >= lastLoggedProgressPct + 10) {
        lastLoggedProgressPct = pct - (pct % 10);
        log(
          `downloading     -> ${pct}% (${formatMb(debugState.downloadedBytes)} / ${formatMb(debugState.totalBytes)})`
        );
      }
      break;
    }

    case 'done': {
      const existing = debugState.files[file];
      if (existing) {
        existing.loaded = existing.total;
        existing.progress = 100;
      }
      recomputeTotals();
      log(`download done   -> ${file}`);
      break;
    }

    case 'ready':
      log('pipeline reports ready');
      break;

    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Pipeline singleton
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let textGenPipelinePromise: Promise<any> | null = null;
let isPipelineReady = false;

// Completed AI results are reused for the same request during this page/module
// lifetime. This avoids paying the 18-21s WebGPU inference cost twice when the
// user clicks the button again; it is separate from the model/pipeline cache.
const explanationResultCache = new Map<string, LocalExplanationResult>();

function getExplanationCacheKey(
  req: LocalExplanationRequest,
  effectiveDistractorExplanation = ''
): string {
  return JSON.stringify([
    req.questionId,
    req.questionText,
    req.correctAnswer,
    req.wrongAnswer,
    req.guestId || '',
    req.correctExplanation || '',
    effectiveDistractorExplanation,
  ]);
}

export function isLocalAiReady(): boolean {
  return isPipelineReady;
}

export function prewarmLocalAi(): void {
  if (typeof window === 'undefined') return;
  publishDebugHandle();
  log('prewarm scheduled (will load model during browser idle time)');
  const runner = () => {
    getPipeline().catch(() => {});
  };
  const win = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(runner);
  } else {
    setTimeout(runner, 1000);
  }
}

export async function getPipeline() {
  if (typeof window === 'undefined') return null;

  if (!textGenPipelinePromise) {
    publishDebugHandle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasWebGpu = typeof navigator !== 'undefined' && Boolean((navigator as any).gpu);
    debugState.webGpuAvailable = hasWebGpu;
    // Only pin the device when WebGPU is present. Valid fallback device names
    // differ between runtimes (browser accepts "wasm", Node accepts "cpu"), so
    // letting transformers.js auto-select avoids an "Unsupported device" throw.
    debugState.device = hasWebGpu ? 'webgpu' : 'auto';
    debugState.status = 'loading';
    debugState.loadStartedAt = Date.now();
    debugState.lastError = null;

    log(
      `init start -> model=${MODEL_ID} task=${MODEL_TASK} dtype=${MODEL_DTYPE} device=${debugState.device}`
    );

    textGenPipelinePromise = (async () => {
      try {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.allowLocalModels = false;
        log('transformers.js loaded, constructing pipeline...');

        const pipe = await pipeline(MODEL_TASK, MODEL_ID, {
          ...(hasWebGpu ? { device: 'webgpu' as const } : {}),
          dtype: MODEL_DTYPE,
          progress_callback: handleModelProgress,
        });

        debugState.status = 'ready';
        debugState.readyAt = Date.now();
        debugState.loadDurationMs = debugState.readyAt - (debugState.loadStartedAt ?? debugState.readyAt);
        debugState.servedFromCache = debugState.downloadedBytes === 0;
        isPipelineReady = true;

        log(
          `READY in ${debugState.loadDurationMs}ms`,
          debugState.servedFromCache
            ? '(served from browser cache, nothing downloaded)'
            : `(downloaded ${formatMb(debugState.downloadedBytes)} across ${Object.keys(debugState.files).length} files)`
        );
        return pipe;
      } catch (err) {
        debugState.status = 'error';
        debugState.lastError = err instanceof Error ? err.message : String(err);
        warn('pipeline init FAILED — every explanation will use the reference template:', err);
        textGenPipelinePromise = null;
        isPipelineReady = false;
        return null;
      }
    })();
  }

  return textGenPipelinePromise;
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
}

function resolveAnswerPlaceholders(text: string, correctAnswer: string, wrongAnswer: string): string {
  return text
    .replace(/[\[<{]\s*correct(?:[_\s-]*answer)\s*[\]}>]/gi, () => correctAnswer)
    .replace(/[\[<{]\s*wrong(?:[_\s-]*answer)\s*[\]}>]/gi, () => wrongAnswer);
}

function containsUnresolvedAnswerPlaceholder(text: string): boolean {
  return /[\[<{]\s*(?:correct|wrong)(?:[_\s-]*answer)\s*[\]}>]/i.test(text);
}

function containsPathologicalRepetition(text: string): boolean {
  // Tiny local models can fall into a greedy repetition loop. Reject three
  // consecutive copies of a word (including hyphenated words) or short phrase.
  const repeatedWord = /\b([a-z0-9]+(?:[-'][a-z0-9]+)?)\b(?:\s*[,;:/]\s*|\s+)\1(?:\s*[,;:/]\s*|\s+)\1\b/i;
  if (repeatedWord.test(text)) return true;

  const repeatedPhrase = /\b(\w+(?:[-']\w+)?(?:\s+\w+(?:[-']\w+)?){1,2})\b(?:\s*[,;:/]\s*|\s+)\1(?:\s*[,;:/]\s*|\s+)\1\b/i;
  return repeatedPhrase.test(text);
}

/**
 * Retained for the legacy full-sentence path and covered by unit tests. The
 * slot-filling path below no longer depends on it, since the template owns the
 * sentence structure.
 */
export function enforceTwoSentences(rawText: string, correctAnswer: string, wrongAnswer: string): string {
  let text = resolveAnswerPlaceholders(
    rawText
      .replace(/<\|im_end\|>/g, '')
      .replace(/<\|im_start\|>assistant/g, '')
      .replace(/^(Assistant|AI|Explanation|Tutor):\s*/i, '')
      .replace(/```[a-z]*\n?|```/g, '')
      .replace(/[\r\n]+/g, ' ')
      .trim(),
    correctAnswer,
    wrongAnswer
  );

  const thinkIndex = text.toLowerCase().indexOf('think of');
  if (thinkIndex !== -1) {
    text = text.slice(thinkIndex);
  }

  const sentenceMatches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentenceMatches && sentenceMatches.length >= 2) {
    return `${sentenceMatches[0].trim()} ${sentenceMatches[1].trim()}`;
  } else if (sentenceMatches && sentenceMatches.length === 1) {
    return sentenceMatches[0].trim();
  }

  return text;
}

function cleanReferenceText(value?: string | null): string {
  const cleaned = stripHtml(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned || containsUnresolvedAnswerPlaceholder(cleaned) || containsPathologicalRepetition(cleaned)) {
    return '';
  }

  return cleaned.split(/[.!?]/)[0].trim();
}

function safeAnswerLabel(value: string, fallback: string): string {
  const cleaned = stripHtml(value).replace(/\s+/g, ' ').trim();
  return cleaned && !containsUnresolvedAnswerPlaceholder(cleaned) ? cleaned : fallback;
}

function normalizeAnswerForMatch(value: string): string {
  return stripHtml(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQuestionSetAnswer(question: LocalExplanationQuestionContext): string {
  const explicitAnswer = question.answer_text?.trim();
  if (explicitAnswer) return explicitAnswer;

  if (
    Array.isArray(question.options)
    && typeof question.correct_answer === 'number'
    && question.correct_answer >= 0
  ) {
    return question.options[question.correct_answer] || '';
  }

  return '';
}

/**
 * Finds a trusted cross-question explanation for a wrong choice. This does not
 * claim the choice is universally wrong: it shows where the same answer is
 * correct in the designated set, which exposes a context mismatch.
 */
export function findQuestionSetWrongChoiceExplanation(
  wrongAnswer: string,
  currentQuestionId: string,
  questionSet?: LocalExplanationQuestionContext[]
): string {
  const target = normalizeAnswerForMatch(wrongAnswer);
  if (!target || !Array.isArray(questionSet)) return '';

  const candidates = questionSet.filter((question) => (
    question.id !== currentQuestionId
    && normalizeAnswerForMatch(getQuestionSetAnswer(question)) === target
  ));
  if (candidates.length === 0) return '';

  const candidate = candidates.find((question) => (
    Boolean(cleanReferenceText(question.correct_explanation || question.explanation))
  )) || candidates[0];
  const candidateQuestion = stripHtml(candidate.question_text || '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim();
  if (!candidateQuestion) return '';

  const answerLabel = safeAnswerLabel(wrongAnswer, 'that choice');
  const reference = cleanReferenceText(candidate.correct_explanation || candidate.explanation);
  return reference
    ? `"${answerLabel}" states "${candidateQuestion}". Its reference says ${reference}`
    : `"${answerLabel}" states "${candidateQuestion}"`;
}

function formatDistractorGrounding(
  req: LocalExplanationRequest
): { explanation: string; source: 'provided distractor' | 'designated question set' | 'none' } {
  const provided = cleanReferenceText(req.distractorExplanation);
  if (provided) return { explanation: provided, source: 'provided distractor' };

  const fromSet = findQuestionSetWrongChoiceExplanation(
    req.wrongAnswer,
    req.questionId,
    req.questionSet
  );
  if (fromSet) return { explanation: fromSet, source: 'designated question set' };

  return { explanation: '', source: 'none' };
}

function formatWrongChoiceContrast(wrongLabel: string, distractorExplanation: string): string {
  const normalized = distractorExplanation.replace(/^the choice\s+/i, '').trim();
  if (/^["']/.test(normalized)) return normalized;

  const startsWithOwnSubject = /^[A-Z]/.test(normalized) || /^the choice\b/i.test(normalized);
  return startsWithOwnSubject
    ? normalized
    : `${wrongLabel} is ${normalized}`;
}

export function buildFallbackExplanation(
  correctAnswer: string,
  wrongAnswer: string,
  correctExplanation?: string | null,
  distractorExplanation?: string | null,
  questionText?: string | null,
  questionSet?: LocalExplanationQuestionContext[],
  questionId?: string
): string {
  const correctLabel = safeAnswerLabel(correctAnswer, 'the answer-key choice');
  const wrongLabel = safeAnswerLabel(wrongAnswer, 'the submitted choice');
  const cleanCorrect = cleanReferenceText(correctExplanation);
  const distractorGrounding = formatDistractorGrounding({
    questionId: questionId || '',
    questionText: questionText || '',
    correctAnswer,
    wrongAnswer,
    correctExplanation,
    distractorExplanation,
    questionSet,
  });
  const cleanWrong = distractorGrounding.explanation;

  if (cleanCorrect) {
    const wrongPart = cleanWrong
      ? formatWrongChoiceContrast(wrongLabel, cleanWrong)
      : `no trusted explanation is stored for why ${wrongLabel} is incorrect`;
    return `Think of ${correctLabel} as ${cleanCorrect}, while ${wrongPart}. ${correctLabel} is the answer recorded in the answer key.`;
  }

  // Without a stored explanation, quote the question stem rather than splicing it
  // into "X is defined as ...", which produced "Mitochondria is defined as Which
  // organelle produces..." Quoting stays grammatical and invents nothing, and it
  // also holds for negative stems and non-English questions.
  const stem = stripHtml(questionText || '').replace(/\s+/g, ' ').trim();
  if (!stem) {
    // Do not invent a reason when no trusted explanation exists.
    return `${correctLabel} is defined as the answer-key choice, while ${wrongLabel} is defined as the submitted choice. Review the principle shown with the question for the supporting reason.`;
  }

  // A statement-style stem often uses "This" as a placeholder for the
  // correct option, for example: "This extends selected AWS services closer
  // to end users." Resolve that placeholder deterministically instead of
  // producing the less useful "X is the answer recorded for ..." wording.
  const resolvedStatement = stem.replace(/^this\b/i, correctLabel);
  if (resolvedStatement !== stem) {
    const statement = /[.!?]$/.test(resolvedStatement) ? resolvedStatement : `${resolvedStatement}.`;
    const contrast = cleanWrong
      ? formatWrongChoiceContrast(wrongLabel, cleanWrong)
      : `No trusted explanation is stored for why ${wrongLabel} is incorrect`;
    return `${statement} ${contrast}.`;
  }

  const contrast = cleanWrong
    ? formatWrongChoiceContrast(wrongLabel, cleanWrong)
    : `no trusted explanation is stored for why ${wrongLabel} is incorrect`;
  return `${correctLabel} is the answer for "${stem}", while ${contrast}.`;
}

/**
 * Sentence 1 is the model's grounded rewrite. Sentence 2 is trusted database
 * text or the answer-key attribution. The two-sentence shape and the verbatim
 * answer labels are guaranteed by construction rather than validated after the
 * fact, which is why the old structural gate could be deleted.
 */
export function composeExplanation(
  aiSentence: string,
  correctLabel: string,
  wrongLabel: string,
  distractorExplanation: string
): string {
  if (!distractorExplanation) {
    return `${aiSentence} ${correctLabel} is the answer-key choice; no trusted explanation is stored for why ${wrongLabel} is incorrect.`;
  }

  const contrast = formatWrongChoiceContrast(wrongLabel, distractorExplanation);
  return `${aiSentence} In contrast, ${contrast}.`;
}

// ---------------------------------------------------------------------------
// Slot generation + grounding validation
// ---------------------------------------------------------------------------

// Long but generic words that a paraphrase may legitimately introduce.
const GENERIC_LONG_WORDS = new Set([
  'against', 'already', 'always', 'another', 'because', 'become', 'becomes', 'before', 'being',
  'better', 'between', 'cannot', 'common', 'compare', 'compared', 'differ', 'different',
  'difference', 'differs', 'during', 'either', 'enough', 'ensure', 'ensures', 'everything',
  'handle', 'handles', 'having', 'includes', 'instead', 'itself', 'little', 'making', 'method',
  'mostly', 'nothing', 'others', 'rather', 'really', 'should', 'simple', 'simpler', 'simply',
  'something', 'sometimes', 'themselves', 'things', 'unlike', 'usually', 'whereas',
  'whether', 'without', 'working',
]);

function extractLongWords(text: string): string[] {
  return (text.toLocaleLowerCase().match(/[a-z]{6,}/g) || []).filter(
    (word) => !GENERIC_LONG_WORDS.has(word)
  );
}

function stemOf(word: string): string {
  return word.slice(0, 5);
}

/**
 * Fraction of the clause's specific (long) words that trace back to the source
 * material. This checks for *invented* terms rather than requiring verbatim
 * overlap, so a good paraphrase is not penalised for replacing long words with
 * simpler ones.
 */
function computeGroundedRatio(clause: string, source: string): number {
  const words = Array.from(new Set(extractLongWords(clause)));
  if (words.length === 0) return 1;

  const sourceStems = new Set(
    (source.toLocaleLowerCase().match(/[a-z]{4,}/g) || []).map(stemOf)
  );
  const grounded = words.filter((word) => sourceStems.has(stemOf(word))).length;
  return grounded / words.length;
}

/**
 * Most imported questions have no stored explanation (the clipboard parser does
 * not produce one), but a definition-style question stem is itself a trusted
 * statement of fact. Turning "Which organelle produces most of the cell's
 * chemical energy?" into a definition lets the model restate it as an answer
 * without inventing anything.
 *
 * Returns '' when the stem cannot safely be read as a definition.
 */
export function deriveDefinitionFromQuestion(questionText?: string | null): string {
  const cleaned = stripHtml(questionText || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  // Negative and "which of these" selection stems do not describe the answer,
  // so restating them would produce a false statement.
  if (/\b(?:not|except|incorrect|false|none of|all of the above)\b/i.test(cleaned)) return '';

  const withoutQuestionMark = cleaned.replace(/\?+\s*$/, '').trim();

  // Strip a leading interrogative so the remainder reads as a predicate.
  const stripped = withoutQuestionMark
    .replace(/^(?:which|what|who|whose)\b/i, '')
    .replace(/^\s*(?:of|among)\s+(?:the\s+)?(?:following|these|choices|options)\b/i, '')
    .replace(/^\s*(?:is|are|was|were)\b/i, '')
    .replace(/^[\s,:-]+/, '')
    .trim();

  const candidate = stripped || withoutQuestionMark;
  if (candidate.split(/\s+/).filter(Boolean).length < 3) return '';

  return candidate;
}

/**
 * Small models mangle acronyms ("Extensible" -> "EXPECT"), which reads as
 * authoritative but is wrong. Long words alone will not catch this, so any
 * all-caps token absent from the source is treated as invented.
 */
function findUngroundedAcronym(clause: string, source: string): string | null {
  const acronyms = clause.match(/\b[A-Z]{2,}\b/g) || [];
  const upperSource = source.toUpperCase();
  for (const acronym of acronyms) {
    if (!upperSource.includes(acronym)) return acronym;
  }
  return null;
}

function mentionsAnswer(clause: string, term: string): boolean {
  const lowerClause = clause.toLocaleLowerCase();
  const lowerTerm = term.toLocaleLowerCase().trim();
  if (!lowerTerm) return true;
  if (lowerClause.includes(lowerTerm)) return true;

  // Multi-word answers may be partially restated; accept the most distinctive word.
  const words = lowerTerm.split(/\s+/).filter((word) => word.length >= 4);
  if (words.length === 0) return false;
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
  return lowerClause.includes(longest);
}

interface SlotValidation {
  ok: boolean;
  reason?: string;
  groundedRatio: number;
}

function validateSlot(clause: string, source: string, term: string): SlotValidation {
  const groundedRatio = computeGroundedRatio(clause, source);

  if (!clause) return { ok: false, reason: 'empty output', groundedRatio };
  if (containsUnresolvedAnswerPlaceholder(clause)) {
    return { ok: false, reason: 'contains an unresolved placeholder', groundedRatio };
  }
  if (containsPathologicalRepetition(clause)) {
    return { ok: false, reason: 'pathological repetition', groundedRatio };
  }

  const wordCount = clause.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_SLOT_WORDS) {
    return { ok: false, reason: `too short (${wordCount} words)`, groundedRatio };
  }
  if (wordCount > MAX_SLOT_WORDS) {
    return { ok: false, reason: `too long (${wordCount} words)`, groundedRatio };
  }

  const normalizedTerm = term.toLocaleLowerCase().trim();
  if (normalizedTerm && clause.toLocaleLowerCase().replace(/[.\s]+$/, '') === normalizedTerm) {
    return { ok: false, reason: 'just echoed the term', groundedRatio };
  }

  // An explanation that never names the answer is not an explanation -- the
  // model sometimes just restates the question stem instead.
  if (!mentionsAnswer(clause, term)) {
    return { ok: false, reason: 'does not mention the correct answer', groundedRatio };
  }

  const inventedAcronym = findUngroundedAcronym(clause, source);
  if (inventedAcronym) {
    return { ok: false, reason: `invented acronym "${inventedAcronym}"`, groundedRatio };
  }

  if (groundedRatio < MIN_GROUNDED_RATIO) {
    return {
      ok: false,
      reason: `ungrounded terms (grounded ratio ${groundedRatio.toFixed(2)} < ${MIN_GROUNDED_RATIO})`,
      groundedRatio,
    };
  }

  return { ok: true, groundedRatio };
}

function normalizeSlot(raw: string): string {
  let text = raw
    .replace(/<pad>|<\/s>|<unk>/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/^\s*(?:sentence|short phrase|phrase|answer|output|rewrite)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Keep the first sentence only.
  const firstSentence = text.match(/^[^.!?]+[.!?]/);
  text = (firstSentence ? firstSentence[0] : text).trim();
  text = text.replace(/[;,\s]+$/, '').trim();
  if (!text) return '';

  // Guarantee sentence casing and terminal punctuation for the template.
  text = text.charAt(0).toLocaleUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text = `${text}.`;
  return text;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractGeneratedText(output: any): string {
  if (Array.isArray(output) && output.length > 0) {
    const generated = output[0]?.generated_text;
    if (typeof generated === 'string') return generated;
    if (Array.isArray(generated)) {
      const last = generated[generated.length - 1];
      if (typeof last?.content === 'string') return last.content;
    }
  }
  if (typeof output?.generated_text === 'string') return output.generated_text;
  return '';
}

async function generateSlot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator: any,
  term: string,
  definition: string,
  promptModifiers: string
): Promise<{ clause: string; raw: string; elapsedMs: number }> {
  // This prompt shape was the best of five tested against this model. Terse
  // completion framing beats multi-rule instructions, which small seq2seq
  // models ignore or echo back.
  const prompt = [
    'Complete the sentence using only the definition.',
    promptModifiers,
    '',
    `Definition: ${definition}`,
    '',
    `Sentence: ${term} is`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  const startedAt = Date.now();
  const output = await generator(prompt, {
    max_new_tokens: MAX_SENTENCE_TOKENS,
    do_sample: false,
    repetition_penalty: 1.1,
  });
  const elapsedMs = Date.now() - startedAt;

  const raw = extractGeneratedText(output);
  return { clause: normalizeSlot(raw), raw, elapsedMs };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function generateLocalExplanation(
  req: LocalExplanationRequest
): Promise<LocalExplanationResult> {
  const start = Date.now();

  debugState.generationCount += 1;
  publishDebugHandle();
  logLocalAiState(`explain requested (question ${req.questionId})`);

  const wrongGrounding = formatDistractorGrounding(req);
  const cacheKey = getExplanationCacheKey(req, wrongGrounding.explanation);
  const cachedResult = explanationResultCache.get(cacheKey);
  if (cachedResult) {
    debugState.cacheHitCount += 1;
    const latencyMs = Date.now() - start;
    log(`cache hit -> reused completed AI result for question ${req.questionId}; no download or inference`);
    return {
      ...cachedResult,
      latencyMs,
      motivationalStim: getRandomMotivationalStim(),
    };
  }

  // Guarantee at least 1500ms loading floor
  const minWaitPromise = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_DURATION_MS));

  const buildFallback = (reason: string): { text: string; isAi: boolean } => {
    const text = buildFallbackExplanation(
      req.correctAnswer,
      req.wrongAnswer,
      req.correctExplanation,
      req.distractorExplanation,
      req.questionText,
      req.questionSet,
      req.questionId
    );
    debugState.fallbackCount += 1;
    debugState.lastFallbackReason = reason;
    warn(`FALLBACK -> showing "Reference Explanation". Reason: ${reason}`);
    log('fallback text  ->', text);
    return {
      text,
      isAi: false,
    };
  };

  const generationPromise = (async (): Promise<{ text: string; isAi: boolean }> => {
    try {
      // Tier 1: a stored answer-key explanation is the ideal grounding source.
      // Tier 2: fall back to the question stem, which is trusted text too.
      const referenceExplanation = cleanReferenceText(req.correctExplanation);
      let groundingText = referenceExplanation;
      let groundingTier = 'stored answer-key explanation';

      if (!groundingText) {
        const derived = deriveDefinitionFromQuestion(req.questionText);
        if (derived) {
          groundingText = derived;
          groundingTier = 'question text (no stored explanation)';
        }
      }

      if (!groundingText) {
        log(
          `received correctExplanation=${JSON.stringify(req.correctExplanation)} questionText=${JSON.stringify(
            stripHtml(req.questionText || '').slice(0, 140)
          )}`
        );
        return buildFallback(
          'no stored answer-key explanation, and the question stem is not usable as a definition (negative/selection phrasing or too short)'
        );
      }

      log(`grounding source: ${groundingTier} -> "${groundingText}"`);

      const generator = await getPipeline();
      if (!generator) {
        return buildFallback(`model unavailable (status=${debugState.status}, error=${debugState.lastError ?? 'none'})`);
      }

      const promptModifiers = getExplanationPromptModifiers(req.guestId);
      const correctLabel = safeAnswerLabel(req.correctAnswer, 'the answer-key choice');
      const wrongLabel = safeAnswerLabel(req.wrongAnswer, 'the submitted choice');
      const distractorExplanation = wrongGrounding.explanation;

      log(
        distractorExplanation
          ? `wrong-choice grounding (${wrongGrounding.source}) -> "${distractorExplanation}"`
          : `wrong-choice grounding -> NONE for "${wrongLabel}"; no trusted reason is available`
      );

      const source = [
        stripHtml(req.questionText || ''),
        referenceExplanation,
        groundingText,
        distractorExplanation,
        correctLabel,
        wrongLabel,
      ]
        .filter(Boolean)
        .join(' ');

      log(
        `generating -> correct="${correctLabel}" wrong="${wrongLabel}"`,
        promptModifiers ? `| modifiers: ${promptModifiers}` : '| no preference modifiers'
      );

      // One generation only: the model rewrites the trusted correct-answer
      // explanation. The contrast sentence uses trusted database text verbatim,
      // so there is nothing for the model to invent there.
      const slot = await generateSlot(generator, correctLabel, groundingText, promptModifiers);
      const check = validateSlot(slot.clause, source, correctLabel);
      log(
        `rewrite ${slot.elapsedMs}ms | raw="${slot.raw}" | sentence="${slot.clause}" | grounded=${check.groundedRatio.toFixed(2)} | ${check.ok ? 'ACCEPTED' : `REJECTED (${check.reason})`}`
      );

      if (!check.ok) {
        return buildFallback(`rewritten sentence rejected: ${check.reason}`);
      }

      if (slot.clause.replace(/[.\s]+$/, '').toLocaleLowerCase() === groundingText.toLocaleLowerCase()) {
        log('note: model returned the source verbatim, so this adds no paraphrase value');
      }

      const explanation = composeExplanation(slot.clause, correctLabel, wrongLabel, distractorExplanation);
      debugState.aiSuccessCount += 1;
      explanationResultCache.set(cacheKey, {
        explanation,
        isAiGenerated: true,
        latencyMs: 0,
      });
      log(`AI SUCCESS -> "${explanation}"`);
      return { text: explanation, isAi: true };
    } catch (error) {
      return buildFallback(`generation threw: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();

  // Cold start (first model download / WebGPU compile) gets a longer budget.
  const timeoutMs = isPipelineReady ? WARM_TIMEOUT_MS : COLD_START_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<{ text: string; isAi: boolean }>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(
        buildFallback(
          `timed out after ${timeoutMs}ms (status=${debugState.status}, download=${debugState.overallProgressPct}%)`
        )
      );
    }, timeoutMs);
  });

  const generationWithTimeout = Promise.race([generationPromise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  // Wait for BOTH generation/timeout and the minimum 1500ms timer
  const [result] = await Promise.all([generationWithTimeout, minWaitPromise]);
  const latencyMs = Date.now() - start;

  log(
    `done in ${latencyMs}ms | source=${result.isAi ? 'AI Explanation' : 'Reference Explanation'} | model status=${debugState.status}`
  );

  return {
    explanation: result.text,
    isAiGenerated: result.isAi,
    latencyMs,
    motivationalStim: getRandomMotivationalStim(),
  };
}

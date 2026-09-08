import { getExplanationPromptModifiers } from './explanationPreferences';

export interface LocalExplanationRequest {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  wrongAnswer: string;
  guestId?: string | null;
  correctExplanation?: string | null;
  distractorExplanation?: string | null;
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

const MIN_LOADING_DURATION_MS = 1500;
const COLD_START_TIMEOUT_MS = 18000;
const WARM_TIMEOUT_MS = 12000;
const MAX_NEW_TOKENS = 48;
const MODEL_ID = 'HuggingFaceTB/SmolLM2-135M-Instruct';

// Module-level pipeline singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let textGenPipelinePromise: Promise<any> | null = null;
let isPipelineReady = false;

export function isLocalAiReady(): boolean {
  return isPipelineReady;
}

export function prewarmLocalAi(): void {
  if (typeof window === 'undefined') return;
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
    textGenPipelinePromise = (async () => {
      try {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.allowLocalModels = false;

        // Try webgpu if available, else wasm
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasWebGpu = typeof navigator !== 'undefined' && Boolean((navigator as any).gpu);
        const device = hasWebGpu ? 'webgpu' : 'wasm';

        const pipe = await pipeline('text-generation', MODEL_ID, {
          device,
          dtype: 'q4', // Quantized 4-bit for minimal memory & instant loading
        });
        isPipelineReady = true;
        return pipe;
      } catch (err) {
        console.warn('Transformers.js model initialization failed, falling back to local synthesizer:', err);
        textGenPipelinePromise = null;
        isPipelineReady = false;
        return null;
      }
    })();
  }
  return textGenPipelinePromise;
}

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

function containsAnswer(text: string, answer: string): boolean {
  const normalizedAnswer = stripHtml(answer).trim().toLocaleLowerCase();
  return Boolean(normalizedAnswer) && text.toLocaleLowerCase().includes(normalizedAnswer);
}

function containsReferenceAnchor(text: string, reference: string): boolean {
  const anchors = Array.from(new Set(reference.toLocaleLowerCase().match(/[a-z0-9]{5,}/g) || []));
  if (anchors.length === 0) return true;

  const matches = anchors.filter((anchor) => text.toLocaleLowerCase().includes(anchor));
  return matches.length >= Math.min(2, anchors.length);
}

function isUsableGeneratedExplanation(
  text: string,
  correctAnswer: string,
  wrongAnswer: string,
  referenceExplanation: string
): boolean {
  if (!text || containsUnresolvedAnswerPlaceholder(text) || containsPathologicalRepetition(text)) {
    return false;
  }

  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences?.length !== 2 || !/^Think of\b/i.test(text)) {
    return false;
  }

  return containsAnswer(text, correctAnswer)
    && containsAnswer(text, wrongAnswer)
    && containsReferenceAnchor(text, referenceExplanation);
}

export function enforceTwoSentences(rawText: string, correctAnswer: string, wrongAnswer: string): string {
  // Clean markdown markers, assistant artifacts, and common prompt placeholders.
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

  // If text contains "Think of", start from there to strip any lingering model chatter.
  const thinkIndex = text.toLowerCase().indexOf('think of');
  if (thinkIndex !== -1) {
    text = text.slice(thinkIndex);
  }

  // Segment sentences.
  const sentenceMatches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentenceMatches && sentenceMatches.length >= 2) {
    return `${sentenceMatches[0].trim()} ${sentenceMatches[1].trim()}`;
  } else if (sentenceMatches && sentenceMatches.length === 1) {
    return sentenceMatches[0].trim();
  }

  // Fallback boundary cap.
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

function formatCorrectDefinition(label: string, value?: string | null): string {
  const cleaned = cleanReferenceText(value);
  if (!cleaned) return '';

  // Replace a leading "This" with the answer label so "This is ..." becomes
  // "<answer> is ..." instead of repeating the subject.
  const subjectReplaced = cleaned.replace(/^this\b/i, label);
  if (subjectReplaced !== cleaned) return subjectReplaced;

  // The question definition may begin with "is". Keep that linking verb once
  // after the answer label instead of producing awkward duplicated wording.
  if (/^is\b/i.test(cleaned)) {
    return `${label} ${cleaned}`;
  }

  return `${label} is defined as ${cleaned}`;
}

export function buildFallbackExplanation(
  correctAnswer: string,
  wrongAnswer: string,
  correctExplanation?: string | null,
  distractorExplanation?: string | null,
  questionText?: string | null
): string {
  const correctLabel = safeAnswerLabel(correctAnswer, 'the answer-key choice');
  const wrongLabel = safeAnswerLabel(wrongAnswer, 'the submitted choice');
  const cleanCorrect = cleanReferenceText(correctExplanation);
  const cleanWrong = cleanReferenceText(distractorExplanation);

  if (cleanCorrect) {
    return `Think of ${correctLabel} as ${cleanCorrect}, while ${wrongLabel} is ${cleanWrong || 'a different concept'}. ${correctLabel} is the answer recorded in the answer key.`;
  }

  const correctDefinition = formatCorrectDefinition(correctLabel, questionText);
  if (correctDefinition) {
    return `${correctDefinition}, while ${wrongLabel} is defined as ${cleanWrong || 'a different concept'}.`;
  }

  // Do not invent a reason from the question text when no trusted explanation exists.
  return `${correctLabel} is defined as the answer-key choice, while ${wrongLabel} is defined as the submitted choice. Review the principle shown with the question for the supporting reason.`;
}

export async function generateLocalExplanation(
  req: LocalExplanationRequest
): Promise<LocalExplanationResult> {
  const start = Date.now();

  // Guarantee at least 1500ms loading floor
  const minWaitPromise = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_DURATION_MS));

  const generationPromise = (async (): Promise<{ text: string; isAi: boolean }> => {
    try {
      const referenceExplanation = cleanReferenceText(req.correctExplanation);
      if (!referenceExplanation) {
        return {
          text: buildFallbackExplanation(
            req.correctAnswer,
            req.wrongAnswer,
            req.correctExplanation,
            req.distractorExplanation,
            req.questionText
          ),
          isAi: false,
        };
      }

      const generator = await getPipeline();
      if (!generator) {
        return {
          text: buildFallbackExplanation(
            req.correctAnswer,
            req.wrongAnswer,
            req.correctExplanation,
            req.distractorExplanation,
            req.questionText
          ),
          isAi: false,
        };
      }

      const promptModifiers = getExplanationPromptModifiers(req.guestId);
      const correctAnswer = safeAnswerLabel(req.correctAnswer, 'the answer-key choice');
      const wrongAnswer = safeAnswerLabel(req.wrongAnswer, 'the submitted choice');
      const distractorExplanation = cleanReferenceText(req.distractorExplanation);
      const messages = [
        {
          role: 'system',
          content: `You are an educational tutor paraphrasing a trusted answer-key explanation.
Rules:
- Write exactly 2 short sentences total.
- Start sentence 1 with "Think of", then use the exact correct answer and wrong answer values.
- Sentence 1 compares the correct answer and wrong answer.
- Sentence 2 may only restate the trusted answer-key explanation; do not add facts.
- Never use placeholders, invent facts, or repeat words or phrases.
- No conversational filler, preambles, or greetings. ${promptModifiers}`.trim(),
        },
        {
          role: 'user',
          content: `Correct Answer: ${correctAnswer}
Student Wrong Answer: ${wrongAnswer}
Trusted Answer-Key Explanation: ${referenceExplanation}${distractorExplanation ? `
Wrong-Choice Explanation: ${distractorExplanation}` : ''}`,
        },
      ];

      // Generate in background (no streaming). Repetition controls are important
      // for the small local model, but the output gate below remains authoritative.
      const output = await generator(messages, {
        max_new_tokens: MAX_NEW_TOKENS,
        temperature: 0.2,
        do_sample: false,
        repetition_penalty: 1.15,
        no_repeat_ngram_size: 3,
      });

      // Extract generated text
      let generatedText = '';
      if (Array.isArray(output) && output[0]?.generated_text) {
        const gen = output[0].generated_text;
        if (Array.isArray(gen)) {
          const lastMsg = gen[gen.length - 1];
          generatedText = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
        } else if (typeof gen === 'string') {
          generatedText = gen;
        }
      }

      if (!generatedText) {
        return {
          text: buildFallbackExplanation(
            req.correctAnswer,
            req.wrongAnswer,
            req.correctExplanation,
            req.distractorExplanation,
            req.questionText
          ),
          isAi: false,
        };
      }

      const cleanTwoSentences = enforceTwoSentences(
        generatedText,
        req.correctAnswer,
        req.wrongAnswer
      );

      if (!isUsableGeneratedExplanation(
        cleanTwoSentences,
        req.correctAnswer,
        req.wrongAnswer,
        referenceExplanation
      )) {
        console.warn('Local generation produced invalid explanation, using fallback');
        return {
          text: buildFallbackExplanation(
            req.correctAnswer,
            req.wrongAnswer,
            req.correctExplanation,
            req.distractorExplanation,
            req.questionText
          ),
          isAi: false,
        };
      }

      return {
        text: cleanTwoSentences,
        isAi: true,
      };
    } catch (error) {
      console.warn('Local generation error, using fallback:', error);
      return {
        text: buildFallbackExplanation(
          req.correctAnswer,
          req.wrongAnswer,
          req.correctExplanation,
          req.distractorExplanation,
          req.questionText
        ),
        isAi: false,
      };
    }
  })();

  // Cold start (first model download / WebGPU compile) gets up to 18s; warm cache gets 12s.
  const timeoutMs = isPipelineReady ? WARM_TIMEOUT_MS : COLD_START_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<{ text: string; isAi: boolean }>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`Local AI explanation timed out after ${timeoutMs}ms, returning instant fallback`);
      resolve({
        text: buildFallbackExplanation(
          req.correctAnswer,
          req.wrongAnswer,
          req.correctExplanation,
          req.distractorExplanation,
          req.questionText
        ),
        isAi: false,
      });
    }, timeoutMs);
  });

  const generationWithTimeout = Promise.race([generationPromise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  // Wait for BOTH generation/timeout and the minimum 1500ms timer
  const [result] = await Promise.all([generationWithTimeout, minWaitPromise]);
  const latencyMs = Date.now() - start;

  return {
    explanation: result.text,
    isAiGenerated: result.isAi,
    latencyMs,
    motivationalStim: getRandomMotivationalStim(),
  };
}

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
const MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';

// Module-level pipeline singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let textGenPipelinePromise: Promise<any> | null = null;

async function getPipeline() {
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

        return await pipeline('text-generation', MODEL_ID, {
          device,
          dtype: 'q4', // Quantized 4-bit for minimal memory & instant loading
        });
      } catch (err) {
        console.warn('Transformers.js model initialization failed, falling back to local synthesizer:', err);
        return null;
      }
    })();
  }
  return textGenPipelinePromise;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
}

export function enforceTwoSentences(rawText: string, correctAnswer: string, wrongAnswer: string): string {
  // Clean markdown markers, assistant artifacts
  let text = rawText
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|im_start\|>assistant/g, '')
    .replace(/^(Assistant|AI|Explanation):\s*/i, '')
    .replace(/```[a-z]*\n?|```/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  // Ensure "Think of" prefix exists
  if (!text.toLowerCase().startsWith('think of')) {
    const thinkIndex = text.toLowerCase().indexOf('think of');
    if (thinkIndex !== -1) {
      text = text.slice(thinkIndex);
    } else {
      text = `Think of ${correctAnswer} as the correct standard, while ${wrongAnswer} serves a different function. ${text}`;
    }
  }

  // Segment sentences
  const sentenceMatches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentenceMatches && sentenceMatches.length >= 2) {
    return `${sentenceMatches[0].trim()} ${sentenceMatches[1].trim()}`;
  } else if (sentenceMatches && sentenceMatches.length === 1) {
    return sentenceMatches[0].trim();
  }

  // Fallback boundary cap
  return text;
}

export function buildFallbackExplanation(
  correctAnswer: string,
  wrongAnswer: string,
  correctExplanation?: string | null,
  distractorExplanation?: string | null
): string {
  const cleanCorrect = correctExplanation
    ? stripHtml(correctExplanation).split('.')[0].trim()
    : `the designated standard for this purpose`;
  const cleanWrong = distractorExplanation
    ? stripHtml(distractorExplanation).split('.')[0].trim()
    : `used for a different mechanism entirely`;

  return `Think of ${correctAnswer} as ${cleanCorrect}, while ${wrongAnswer} is ${cleanWrong}. ${correctAnswer} is the specific standard required for this question.`;
}

export async function generateLocalExplanation(
  req: LocalExplanationRequest
): Promise<LocalExplanationResult> {
  const start = Date.now();

  // Guarantee at least 1500ms loading floor
  const minWaitPromise = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_DURATION_MS));

  const generationPromise = (async (): Promise<{ text: string; isAi: boolean }> => {
    try {
      const generator = await getPipeline();
      if (!generator) {
        return {
          text: buildFallbackExplanation(
            req.correctAnswer,
            req.wrongAnswer,
            req.correctExplanation,
            req.distractorExplanation
          ),
          isAi: false,
        };
      }

      const promptModifiers = getExplanationPromptModifiers(req.guestId);
      const messages = [
        {
          role: 'system',
          content: `You are an educational tutor. Compare the correct answer and the student's wrong choice.
Instruction: Write EXACTLY two sentences.
Sentence 1: Think of ${req.correctAnswer} as [simple physical analogy/simplified explanation], while ${req.wrongAnswer} is [simple physical analogy/simplified explanation].
Sentence 2: [One short sentence explaining why ${req.correctAnswer} correctly answers the question].
Constraint: Exactly 2 simple sentences. Student friendly. No preamble. ${promptModifiers}`.trim(),
        },
        {
          role: 'user',
          content: `Question: ${stripHtml(req.questionText)}\nCorrect Answer: ${req.correctAnswer}\nStudent Wrong Answer: ${req.wrongAnswer}`,
        },
      ];

      // Generate in background (no streaming)
      const output = await generator(messages, {
        max_new_tokens: 75,
        temperature: 0.2,
        do_sample: false,
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
            req.distractorExplanation
          ),
          isAi: false,
        };
      }

      const cleanTwoSentences = enforceTwoSentences(
        generatedText,
        req.correctAnswer,
        req.wrongAnswer
      );

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
          req.distractorExplanation
        ),
        isAi: false,
      };
    }
  })();

  // Wait for BOTH generation and the minimum 1500ms timer
  const [result] = await Promise.all([generationPromise, minWaitPromise]);
  const latencyMs = Date.now() - start;

  return {
    explanation: result.text,
    isAiGenerated: result.isAi,
    latencyMs,
    motivationalStim: getRandomMotivationalStim(),
  };
}

import { GoogleGenAI } from '@google/genai';
import { AiModelConfig } from '@quiz-creator/core/services';
import { NextResponse } from 'next/server';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { assertAllowedOrigin, assertPlainObject, boundedString, enforceRateLimit, readJsonBody, withTimeout } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';
import type { SceneNode, SceneReaction, SceneStep, SceneTemplate, StudyScene } from '@/lib/ai/sceneTypes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_NODES = 8;
const MAX_STEPS = 6;
const MAX_LABEL = 80;
const MAX_CAPTION = 180;
const sceneCache = new Map<string, StudyScene>();

function cleanText(value: unknown, max: number) {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}

function sceneTemplate(value: unknown): SceneTemplate {
  return value === 'layers' || value === 'compare' || value === 'cycle' ? value : 'flow';
}

function validateScene(value: unknown): StudyScene {
  const record = assertPlainObject(value, 'scene');
  const rawNodes = Array.isArray(record.nodes) ? record.nodes.slice(0, MAX_NODES) : [];
  const rawSteps = Array.isArray(record.steps) ? record.steps.slice(0, MAX_STEPS) : [];
  const nodes: SceneNode[] = rawNodes.map((item, index) => {
    const node = assertPlainObject(item, `scene.nodes[${index}]`);
    const kind = node.kind === 'input' || node.kind === 'output' || node.kind === 'warning' || node.kind === 'choice' ? node.kind : 'concept';
    return { id: cleanText(node.id, 40) || `node-${index + 1}`, label: cleanText(node.label, MAX_LABEL) || `Step ${index + 1}`, kind };
  });
  if (nodes.length < 2) throw new Error('scene needs at least two nodes');
  const nodeIds = new Set(nodes.map((node) => node.id));
  const steps: SceneStep[] = rawSteps.map((item, index) => {
    const step = assertPlainObject(item, `scene.steps[${index}]`);
    const reaction: SceneReaction = step.reaction === 'surprised' || step.reaction === 'happy' ? step.reaction : 'idle';
    const highlight = cleanText(step.highlight, 40);
    return { highlight: nodeIds.has(highlight) ? highlight : nodes[Math.min(index, nodes.length - 1)].id, caption: cleanText(step.caption, MAX_CAPTION) || 'Notice how this part connects.', reaction };
  });
  if (steps.length < 2) throw new Error('scene needs at least two steps');
  return { template: sceneTemplate(record.template), nodes, steps };
}

function fallbackScene(question: string, answer: string, explanation: string): StudyScene {
  const labels = [cleanText(question, 48) || 'Question', cleanText(answer, 48) || 'Answer', cleanText(explanation, 48) || 'Why it works'];
  return {
    template: 'flow',
    nodes: labels.map((label, index) => ({ id: `node-${index + 1}`, label, kind: index === 0 ? 'input' : index === 2 ? 'output' : 'concept' })),
    steps: [
      { highlight: 'node-1', caption: 'Start with the card question and identify the key idea.', reaction: 'idle' },
      { highlight: 'node-2', caption: `Connect it to the answer: ${labels[1]}.`, reaction: 'surprised' },
      { highlight: 'node-3', caption: explanation ? 'Use the explanation to lock in why this answer fits.' : 'The card does not include enough explanation for a deeper animation.', reaction: explanation ? 'happy' : 'idle' },
    ],
  };
}

function promptFor(question: string, answer: string, explanation: string) {
  return `Create a short educational scene as JSON only. Use no HTML, SVG, markdown, or code. The scene must be grounded only in CARD_CONTEXT. Choose template flow, layers, compare, or cycle. Use 2-8 nodes and 2-6 ordered steps. Each caption is one sentence under 180 characters. Highlight must match a node id. Use reaction idle, surprised when a key transition lands, or happy when the answer is confirmed. If context is thin, say so in a caption instead of inventing facts.\nCARD_CONTEXT\nQUESTION: ${question}\nANSWER: ${answer || 'Not provided'}\nEXPLANATION: ${explanation || 'Not provided'}`;
}

export const POST = createApiRoute(async ({ req, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'kole-scene', userId, 20, 60 * 60 * 1000);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.sessionBodyBytes);
  const quizId = boundedString(body.quizId, 'quizId', 128, true)!;
  const questionId = boundedString(body.questionId, 'questionId', 128, true)!;
  const cacheKey = `${quizId}:${questionId}`;
  const cached = sceneCache.get(cacheKey);
  if (cached) return NextResponse.json({ scene: cached, cacheHit: true });

  const repository = await getQuizRepository();
  const quiz = await repository.getQuizById(quizId, userId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  const questions = await repository.getQuestionsByQuizId(quizId, userId);
  const question = questions.find((item) => item.id === questionId);
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  const questionText = cleanText(question.question_text, 1_000);
  const answer = cleanText(question.answer_text || question.options?.[question.correct_answer], 600);
  const explanation = cleanText(question.correct_explanation || question.explanation, 800);
  let scene = fallbackScene(questionText, answer, explanation);
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const result = await withTimeout(AiModelConfig.executeGeminiWithFallback(AiModelConfig.getGeminiModel(), async (model) => {
        const response = await ai.models.generateContent({ model, contents: promptFor(questionText, answer, explanation), config: { temperature: 0.35, maxOutputTokens: 900, responseMimeType: 'application/json' } });
        return typeof response.text === 'string' ? response.text : '';
      }), 12_000, 'Scene generation timed out');
      const parsed = JSON.parse(result.result.replace(/^```json\s*|\s*```$/g, '').trim());
      scene = validateScene(parsed);
    } catch (error) {
      console.warn('[Kole scene] using grounded fallback', error);
    }
  }
  sceneCache.set(cacheKey, scene);
  return NextResponse.json({ scene, cacheHit: false }, { headers: { 'Cache-Control': 'no-store' } });
}, { cache: 'noStore' });

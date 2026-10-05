'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { SceneNode, SceneReaction, SceneStep, StudyScene } from '@/lib/ai/sceneTypes';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; quizId: string; questionId: string; question: string; reaction?: SceneReaction; onReaction?: (reaction: SceneReaction) => void };

function Node({ node, active }: { node: SceneNode; active: boolean }) {
  return <div className={`kole-scene-node kole-scene-node--${node.kind || 'concept'} ${active ? 'kole-scene-node--active' : ''}`}><span>{node.label}</span></div>;
}

function SceneStage({ scene, step, reducedMotion }: { scene: StudyScene; step: number; reducedMotion: boolean }) {
  const current = scene.steps[step];
  const active = new Set(scene.steps.slice(0, step + 1).map((item) => item.highlight));
  return <div className={`kole-scene-stage kole-scene-stage--${scene.template} ${reducedMotion ? 'kole-scene-stage--static' : ''}`}>
    <div className="kole-scene-nodes">{scene.nodes.map((node) => <Node key={node.id} node={node} active={active.has(node.id)} />)}</div>
    <div className="kole-scene-caption" aria-live="polite"><Sparkles className="h-4 w-4 shrink-0 text-primary" />{current.caption}</div>
  </div>;
}

export default function KoleSceneModal({ open, onOpenChange, quizId, questionId, question, reaction = 'idle', onReaction }: Props) {
  const [scene, setScene] = useState<StudyScene | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0); setPlaying(false); setError('');
    setLoading(true);
    fetch('/api/ai/scene', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId, questionId }) })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not build this scene.'); return payload.scene as StudyScene; })
      .then((nextScene) => { setScene(nextScene); onReaction?.(nextScene.steps[0]?.reaction || 'idle'); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not build this scene.'))
      .finally(() => setLoading(false));
  }, [open, quizId, questionId, onReaction]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!playing || !scene || reducedMotion) return;
    const timer = window.setInterval(() => setStep((current) => {
      if (current >= scene.steps.length - 1) { setPlaying(false); return current; }
      const next = current + 1; onReaction?.(scene.steps[next].reaction || 'idle'); return next;
    }), 2200);
    return () => window.clearInterval(timer);
  }, [playing, scene, reducedMotion, onReaction]);

  const currentStep: SceneStep | undefined = useMemo(() => scene?.steps[step], [scene, step]);
  const moveNext = () => { if (!scene) return; const next = Math.min(step + 1, scene.steps.length - 1); setStep(next); onReaction?.(scene.steps[next].reaction || 'idle'); };
  const replay = () => { setStep(0); setPlaying(!reducedMotion); onReaction?.(scene?.steps[0]?.reaction || 'idle'); };

  return <Modal open={open} onOpenChange={onOpenChange} title={`Kole’s animated explanation${reaction === 'surprised' ? ' · Wow!' : reaction === 'happy' ? ' · You got it!' : ''}`} description={question} maxWidth="max-w-2xl" contentClassName="space-y-4">
    {loading && <div className="flex min-h-64 items-center justify-center text-sm font-bold text-muted-foreground">Kole is sketching the idea…</div>}
    {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    {scene && !loading && <>
      <SceneStage scene={scene} step={step} reducedMotion={reducedMotion} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-muted-foreground">Step {step + 1} of {scene.steps.length}{reducedMotion ? ' · Motion reduced' : ''}</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={replay} className="kole-scene-control" aria-label="Replay scene"><RotateCcw className="h-4 w-4" /></button>
          <button type="button" onClick={() => setPlaying((value) => !value)} disabled={reducedMotion || step >= scene.steps.length - 1} className="kole-scene-control" aria-label={playing ? 'Pause scene' : 'Play scene'}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
          <button type="button" onClick={moveNext} disabled={step >= scene.steps.length - 1} className="kole-scene-control" aria-label="Next scene step"><SkipForward className="h-4 w-4" /></button>
        </div>
      </div>
      {currentStep && <p className="sr-only">{currentStep.caption}</p>}
    </>}
  </Modal>;
}

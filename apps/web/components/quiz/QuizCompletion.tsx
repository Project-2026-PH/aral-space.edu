'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Brain,
  Check,
  Clock,
  Gauge,
  Layers,
  RotateCw,
  Tag
} from 'lucide-react';
import { SessionTelemetryService } from '@quiz-creator/core';
import type {
  CardTelemetryRecord,
  Quiz,
  QuizQuestion,
  SessionMasterySummary
} from '@quiz-creator/types';

interface QuizCompletionProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  summary: SessionMasterySummary;
  cardTelemetry: Record<string, CardTelemetryRecord>;
  accumulatedStruggleIds: string[];
  onStartStruggleReview: () => void;
}

type TelemetryTab = 'all' | 'green' | 'yellow' | 'red';

export default function QuizCompletion({
  quiz,
  questions,
  summary,
  cardTelemetry,
  accumulatedStruggleIds,
  onStartStruggleReview
}: QuizCompletionProps) {
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<TelemetryTab>('all');
  const deckMedianSec = (summary.deckMedianLatencyMs / 1000).toFixed(1);
  const hesitationThresholdSec = ((summary.deckMedianLatencyMs * 1.5) / 1000).toFixed(1);
  const conceptEntries = Object.entries(summary.conceptErrorDensity).sort((a, b) => b[1] - a[1]);
  const reviewTopicCount = conceptEntries.filter(([, misses]) => misses > 0).length;
  const firstPassMasteryScore = questions.length > 0
    ? Math.round((summary.buckets.green.length / questions.length) * 100)
    : 100;

  const toggleTab = (tab: Exclude<TelemetryTab, 'all'>) => {
    setActiveTelemetryTab(activeTelemetryTab === tab ? 'all' : tab);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6 animate-fade-in text-center">
      <div className="space-y-3">
        <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-500 shadow-sm ring-1 ring-emerald-500/20"><Award className="h-10 w-10" /></div>
        <div className="space-y-0.5"><h2 className="text-2xl font-black text-foreground tracking-tight">Reviewer Mastery</h2><p className="text-xs text-muted-foreground">Your Performance Breakdown</p></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs text-center space-y-1"><span className="text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5 text-primary" />Typical Speed</span><p className="text-xl font-black text-foreground">{deckMedianSec}s</p><p className="text-[10px] text-muted-foreground">per Question</p></div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs text-center space-y-1"><span className="text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1"><Gauge className="h-3.5 w-3.5 text-amber-500" />Longest Pause</span><p className="text-xl font-black text-amber-500">&gt; {hesitationThresholdSec}s</p><p className="text-[10px] text-muted-foreground">Slower than your usual pace</p></div>
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-border/80 bg-card p-4 shadow-2xs text-center space-y-1"><span className="text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1"><Brain className="h-3.5 w-3.5 text-emerald-500" />First-Try Mastery</span><p className="text-xl font-black text-emerald-500">{firstPassMasteryScore}%</p><p className="text-[10px] text-muted-foreground">Answers on first try</p></div>
      </div>

      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4 text-left">
        <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5"><Layers className="h-4 w-4 text-primary" /><span>Objective Mastery Tiering</span></h3><span className="text-[11px] text-muted-foreground font-medium">{questions.length} cards categorized</span></div>
        <div className="grid grid-cols-3 gap-2.5">
          <button type="button" onClick={() => toggleTab('green')} className={`cursor-pointer rounded-2xl border p-3 text-center transition-all ${activeTelemetryTab === 'green' ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30' : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'}`}><span className="text-emerald-600 font-bold text-xs">Got it</span><p className="text-2xl font-black text-emerald-600 mt-1">{summary.buckets.green.length}</p><p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Answers on first try</p></button>
          <button type="button" onClick={() => toggleTab('yellow')} className={`cursor-pointer rounded-2xl border p-3 text-center transition-all ${activeTelemetryTab === 'yellow' ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30' : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'}`}><span className="text-amber-600 font-bold text-xs">Needs Practice</span><p className="text-2xl font-black text-amber-600 mt-1">{summary.buckets.yellow.length}</p><p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Slow or took a second try</p></button>
          <button type="button" onClick={() => toggleTab('red')} className={`cursor-pointer rounded-2xl border p-3 text-center transition-all ${activeTelemetryTab === 'red' ? 'border-destructive bg-destructive/10 ring-2 ring-destructive/30' : 'border-destructive/30 bg-destructive/5 hover:border-destructive/50'}`}><span className="text-destructive font-bold text-xs">Keep Studying</span><p className="text-2xl font-black text-destructive mt-1">{summary.buckets.red.length}</p><p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Missed more than once</p></button>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground"><span>Card Breakdown {activeTelemetryTab !== 'all' ? `(${activeTelemetryTab.toUpperCase()})` : ''}</span>{activeTelemetryTab !== 'all' && <button type="button" onClick={() => setActiveTelemetryTab('all')} className="text-primary hover:underline">Show all</button>}</div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {questions.filter((question) => activeTelemetryTab === 'all' || summary.buckets[activeTelemetryTab].includes(question.id)).map((question) => {
              const record = cardTelemetry[question.id];
              const bucket = summary.buckets.green.includes(question.id) ? 'green' : summary.buckets.yellow.includes(question.id) ? 'yellow' : 'red';
              const latencySec = record?.timeToCorrectMs ? `${(record.timeToCorrectMs / 1000).toFixed(1)}s` : record?.latenciesMs?.[0] ? `${(record.latenciesMs[0] / 1000).toFixed(1)}s` : '—';
              const isHesitant = Boolean(record && record.firstPassCorrect && SessionTelemetryService.isHesitant(record.latenciesMs?.[0] || record.timeToCorrectMs || 0, summary.deckMedianLatencyMs));
              return (
                <div key={question.id} className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-left space-y-1.5">
                  <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-foreground line-clamp-2">{question.question_text}</p><div className="shrink-0">{bucket === 'green' && <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600">✓ Got it ({latencySec})</span>}{bucket === 'yellow' && <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600">🟡 {isHesitant ? `Hesitant (${latencySec})` : 'Recovered'}</span>}{bucket === 'red' && <span className="rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">🔴 At-Risk ({record?.totalMisses || 0} misses)</span>}</div></div>
                  {question.concept_tags && question.concept_tags.length > 0 && <div className="flex items-center gap-1.5 flex-wrap">{question.concept_tags.map((tag, index) => <span key={index} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">#{tag}</span>)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3 text-left">
        <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5"><Tag className="h-4 w-4 text-primary" /><span>Topics to Review</span></h3><span className="text-[11px] text-muted-foreground">{reviewTopicCount > 0 ? `${reviewTopicCount} topic${reviewTopicCount > 1 ? 's' : ''} to review` : 'Nothing to review — nice work!'}</span></div>
        <div className="flex flex-wrap gap-2 pt-1">{conceptEntries.map(([tag, misses]) => { const displayTag = tag === 'general' ? 'All Topics' : `#${tag}`; return misses > 0 ? <span key={tag} className="inline-flex items-center gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive"><AlertCircle className="h-3.5 w-3.5" /><span>{displayTag}</span><span className="rounded-full bg-destructive/20 px-1.5 py-0.2 text-[10px]">{misses} miss{misses > 1 ? 'es' : ''}</span></span> : <span key={tag} className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-semibold text-emerald-600"><Check className="h-3.5 w-3.5 text-emerald-500" /><span>{displayTag}</span></span>; })}</div>
      </div>

      {accumulatedStruggleIds.length > 0 && <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5 text-left space-y-3"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><h3 className="text-xs font-bold text-foreground">Anti-Fatigue Struggle Pile</h3></div><p className="text-xs text-muted-foreground leading-relaxed">{accumulatedStruggleIds.length} card{accumulatedStruggleIds.length > 1 ? 's' : ''} missed 3 attempts and {accumulatedStruggleIds.length > 1 ? 'were' : 'was'} moved to the Struggle Pile to prevent burnout.</p><button type="button" onClick={onStartStruggleReview} className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95"><RotateCw className="h-3.5 w-3.5" /><span>Review Struggle Pile Now ({accumulatedStruggleIds.length})</span></button></div>}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {accumulatedStruggleIds.length > 0 && <button type="button" onClick={onStartStruggleReview} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-6 py-3 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95 shadow-sm"><RotateCw className="h-3.5 w-3.5" /><span>Review Struggle Pile ({accumulatedStruggleIds.length})</span></button>}
        <Link href={`/quizzes/${quiz.id}`} className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95">Back to Overview</Link>
        <Link href="/quizzes" className="rounded-2xl border border-border bg-card px-6 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-95">Back to Library</Link>
      </div>
    </div>
  );
}

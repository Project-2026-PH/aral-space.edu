'use client';

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { ArrowRight, Rocket, Sparkles } from 'lucide-react';
import { M } from 'vitest/dist/chunks/reporters.d.BuRON0I0.js';

const AI_COMING_SOON_MESSAGES = [
  'Madaling-madali sa panting may igit????',
  'WALA PANG AI BUSSENG!',
  'Excited yarn?',
  'Kada gamit mo nito, bawal ka maligo bff ah',
  'Osigi mamatay na lang tayong lahat, madaling-madali ehh',
  'Edi naubos tubig natin niyan bff',
  'Hin is tay ayaw, AI gosto? Aray mo pakak!',
  'Ayun talagang ganado sha',
  'Mama mama kal is ma, sayo lahat ito',
  'Mauuna muna siguro makulong mga Corrupt bago magkaroon nito',
] as const;

interface GenerateQuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects?: Array<{ id: string; name: string; color?: string }>;
  onGenerated?: (quizId: string) => void;
}

export default function GenerateQuizModal({
  open,
  onOpenChange,
}: GenerateQuizModalProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!open) return;

    setMessageIndex((current) => (current + 1) % AI_COMING_SOON_MESSAGES.length);
  }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Generate with AI is coming soon..."
      description="Ubusan tayo ng Tubig dito tapos kayo kalaban ko."
      maxWidth="max-w-lg"
    >
      <div className="space-y-5 pt-2">
        <div className="relative overflow-hidden rounded-3xl border-3 border-slate-900 bg-[#fde047] p-5 text-slate-900 shadow-brutal sm:p-7">
          <div className="pointer-events-none absolute -right-5 -top-5 rotate-12 text-slate-900/10">
            <Sparkles className="h-28 w-28" aria-hidden="true" />
          </div>
          <div className="relative space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em]">
              <Rocket className="h-4 w-4" aria-hidden="true" />
              <span>"ahh may gamot?" OO MAG HINTAY KA BFF</span>
            </div>
            <p
              className="text-xl font-black leading-tight sm:text-2xl"
              role="status"
              aria-live="polite"
            >
              {AI_COMING_SOON_MESSAGES[messageIndex]}
            </p>
            <p className="max-w-md text-sm font-bold leading-relaxed text-slate-900/75">
              We’re just... giving your study sidekick a little extra polish - iykyk. The glow-up will be worth the wait ante!
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-border/70 bg-muted/20 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            In the meantime
          </p>
          <p className="mt-1 text-sm font-bold text-foreground">
            Proceed ka muna sa pag create manually, using our smart clipboard hehe
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-primary px-4 py-2.5 text-xs font-black text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <span>Osigisigi, wit q nlng haha</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  );
}

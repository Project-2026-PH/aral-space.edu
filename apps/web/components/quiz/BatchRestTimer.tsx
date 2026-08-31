'use client';

import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight } from 'lucide-react';

interface BatchRestTimerProps {
  completedBatch: number;
  nextBatch: number;
  onContinue: () => void;
}

export default function BatchRestTimer({
  completedBatch,
  nextBatch,
  onContinue
}: BatchRestTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-card p-8 text-center shadow-2xl space-y-5 animate-fade-in">
        <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary mx-auto">
          <Clock className="h-8 w-8 animate-pulse" />
        </div>

        <div>
          <h3 className="text-xl font-extrabold text-foreground">
            Batch #{completedBatch + 1} Mastered!
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Take a 30-second cognitive breath before starting Batch #{nextBatch + 1}.
          </p>
        </div>

        <div className="py-4">
          <span className="text-4xl font-extrabold text-primary font-mono">
            {secondsRemaining > 0 ? `00:${String(secondsRemaining).padStart(2, '0')}` : "Ready!"}
          </span>
        </div>

        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
        >
          <span>Continue to Batch #{nextBatch + 1}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

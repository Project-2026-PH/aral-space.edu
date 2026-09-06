'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Plus, BookOpen } from 'lucide-react';

interface NotFoundViewProps {
  title?: string;
  subtitle?: string;
  showBackAction?: boolean;
  showQuickLinks?: boolean;
}

type EyeState = 'dizzy' | 'blinking' | 'glancing';

export default function NotFoundView({
  title = 'Error 404',
  subtitle = 'With Aral Space, you deliver faster, smarter, and more consistent learning while mastering quizzes and boosting knowledge retention. But the page you are looking for does not exist.',
  showBackAction = true,
  showQuickLinks = true,
}: NotFoundViewProps) {
  const router = useRouter();
  const mascotRef = useRef<HTMLDivElement>(null);

  const [eyeState, setEyeState] = useState<EyeState>('dizzy');
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const activeTimersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = useCallback(() => {
    activeTimersRef.current.forEach(clearTimeout);
    activeTimersRef.current = [];
  }, []);

  const triggerGlimpseSequence = useCallback((duration = 2000) => {
    clearTimers();

    // 1. Initial blink to open eyes
    setEyeState('blinking');

    const t1 = setTimeout(() => {
      // 2. Open curious eyes looking at user
      setEyeState('glancing');

      // 3. Optional mini double-take blink during glance
      const t2 = setTimeout(() => {
        setEyeState('blinking');
        const t3 = setTimeout(() => {
          setEyeState('glancing');
        }, 110);
        activeTimersRef.current.push(t3);
      }, duration * 0.45);

      // 4. Blink shut
      const t4 = setTimeout(() => {
        setEyeState('blinking');
        // 5. Back to dizzy sleep
        const t5 = setTimeout(() => {
          setEyeState('dizzy');
          setEyeOffset({ x: 0, y: 0 });
        }, 130);
        activeTimersRef.current.push(t5);
      }, duration);

      activeTimersRef.current.push(t2, t4);
    }, 120);

    activeTimersRef.current.push(t1);
  }, [clearTimers]);

  // Periodic automatic glimpse loop every 4.8 seconds when not actively hovered
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      triggerGlimpseSequence(1900);
    }, 4800);

    return () => {
      clearInterval(interval);
      clearTimers();
    };
  }, [isHovered, triggerGlimpseSequence, clearTimers]);

  // Mouse tracking on mascot to make pupils gaze toward the cursor
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mascotRef.current) return;
    const rect = mascotRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = (e.clientX - centerX) / (rect.width / 2);
    const dy = (e.clientY - centerY) / (rect.height / 2);

    setEyeOffset({
      x: Math.max(-5.5, Math.min(5.5, dx * 5.5)),
      y: Math.max(-4.5, Math.min(4.5, dy * 4.5)),
    });
  };

  const handlePointerEnter = () => {
    setIsHovered(true);
    triggerGlimpseSequence(3200);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    // Smooth reset to dizzy after short delay
    const t = setTimeout(() => {
      setEyeState('blinking');
      const t2 = setTimeout(() => {
        setEyeState('dizzy');
        setEyeOffset({ x: 0, y: 0 });
      }, 120);
      activeTimersRef.current.push(t2);
    }, 400);
    activeTimersRef.current.push(t);
  };

  return (
    <div className="relative min-h-[calc(100vh-10rem)] w-full flex flex-col items-center justify-center overflow-hidden px-4 py-10 sm:py-16 text-center select-none">
      {/* Ambient background glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div className="h-[480px] w-[620px] rounded-full bg-primary/12 blur-[130px] dark:bg-primary/20" />
      </div>

      {/* Decorative blurred mosaic tiles matching reference layout */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex justify-between overflow-hidden opacity-40 dark:opacity-20"
      >
        {/* Left mosaic cluster */}
        <div className="grid grid-cols-3 gap-3.5 -translate-x-12 -translate-y-6 sm:translate-x-4">
          <div className="h-24 w-24 rounded-2xl bg-primary/10 blur-[1px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/20 blur-[2px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/5" />
          <div className="h-24 w-24 rounded-2xl bg-primary/15" />
          <div className="h-24 w-24 rounded-2xl bg-primary/10 blur-[1px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/25 blur-[3px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/5" />
          <div className="h-24 w-24 rounded-2xl bg-primary/15 blur-[2px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/10" />
        </div>

        {/* Right mosaic cluster */}
        <div className="grid grid-cols-3 gap-3.5 translate-x-12 sm:-translate-x-4">
          <div className="h-24 w-24 rounded-2xl bg-primary/10 blur-[2px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/15" />
          <div className="h-24 w-24 rounded-2xl bg-primary/5 blur-[1px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/25 blur-[3px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/10" />
          <div className="h-24 w-24 rounded-2xl bg-primary/20 blur-[1px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/15" />
          <div className="h-24 w-24 rounded-2xl bg-primary/5 blur-[2px]" />
          <div className="h-24 w-24 rounded-2xl bg-primary/10" />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
        {/* Enlarged Robot 404 Mascot with Interactive Blinking Eyes */}
        <div
          ref={mascotRef}
          onPointerMove={handlePointerMove}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={() => triggerGlimpseSequence(2600)}
          className="relative mb-8 flex flex-col items-center cursor-pointer group"
          title="Click or hover to wake robot!"
        >
          <div className="animate-float-slow transition-transform hover:scale-105 duration-300 ease-out">
            <svg
              viewBox="0 0 280 250"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-52 w-52 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80 text-primary drop-shadow-2xl transition-colors duration-300"
              role="img"
              aria-label="404 Dizzy Robot Mascot that blinks and catches glimpses"
            >
              {/* Antenna Ping Wave (radiates when catching a glimpse of the user) */}
              {eyeState === 'glancing' && (
                <>
                  <circle
                    cx="58"
                    cy="20"
                    r="18"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    opacity="0.3"
                    className="animate-ping"
                  />
                  <circle
                    cx="222"
                    cy="20"
                    r="18"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    opacity="0.3"
                    className="animate-ping"
                  />
                </>
              )}

              {/* Left Antenna Base Collar */}
              <rect
                x="94"
                y="66"
                width="14"
                height="6"
                rx="3"
                transform="rotate(-40 94 66)"
                fill="currentColor"
                opacity="0.8"
              />

              {/* Left Antenna Stalk & Sphere */}
              <line
                x1="94"
                y1="68"
                x2="64"
                y2="28"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <circle cx="58" cy="20" r="14" fill="currentColor" />
              {/* Left Antenna Specular Highlight */}
              <circle cx="54" cy="16" r="3.5" fill="#FFFFFF" opacity="0.55" />

              {/* Right Antenna Base Collar */}
              <rect
                x="174"
                y="57"
                width="14"
                height="6"
                rx="3"
                transform="rotate(40 174 57)"
                fill="currentColor"
                opacity="0.8"
              />

              {/* Right Antenna Stalk & Sphere */}
              <line
                x1="186"
                y1="68"
                x2="216"
                y2="28"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <circle cx="222" cy="20" r="14" fill="currentColor" />
              {/* Right Antenna Specular Highlight */}
              <circle cx="218" cy="16" r="3.5" fill="#FFFFFF" opacity="0.55" />

              {/* Left Ear Pod */}
              <rect
                x="32"
                y="114"
                width="22"
                height="44"
                rx="11"
                fill="currentColor"
              />
              {/* Left Ear Inset Slot */}
              <rect
                x="37"
                y="123"
                width="6"
                height="26"
                rx="3"
                fill="#FFFFFF"
                opacity="0.22"
              />

              {/* Right Ear Pod */}
              <rect
                x="226"
                y="114"
                width="22"
                height="44"
                rx="11"
                fill="currentColor"
              />
              {/* Right Ear Inset Slot */}
              <rect
                x="237"
                y="123"
                width="6"
                height="26"
                rx="3"
                fill="#FFFFFF"
                opacity="0.22"
              />

              {/* Robot Head Body */}
              <path
                d="M 52,112 C 52,68 86,52 140,52 C 194,52 228,68 228,112 C 228,172 192,210 140,210 C 88,210 52,172 52,112 Z"
                fill="currentColor"
              />

              {/* Head Crown Highlight Arc (Minimalist Gloss) */}
              <path
                d="M 96,68 C 110,61 125,58 140,58 C 155,58 170,61 184,68 C 170,63 155,61 140,61 C 125,61 110,63 96,68 Z"
                fill="#FFFFFF"
                opacity="0.25"
              />

              {/* Visor Display Screen */}
              <rect
                x="68"
                y="102"
                width="144"
                height="74"
                rx="28"
                fill="#FFFFFF"
                className="dark:fill-slate-100"
              />

              {/* Visor Top Glare Highlight */}
              <path
                d="M 88,112 C 104,106 122,104 140,104 C 158,104 176,106 192,112 C 180,108 160,106 140,106 C 120,106 100,108 88,112 Z"
                fill="#FFFFFF"
                opacity="0.8"
              />

              {/* EYE STATE RENDERING */}
              {eyeState === 'dizzy' && (
                <>
                  {/* Left 'X' Eye */}
                  <g className="text-primary transition-opacity duration-150">
                    <line
                      x1="93"
                      y1="126"
                      x2="121"
                      y2="152"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <line
                      x1="121"
                      y1="126"
                      x2="93"
                      y2="152"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                  </g>

                  {/* Right 'X' Eye */}
                  <g className="text-primary transition-opacity duration-150">
                    <line
                      x1="159"
                      y1="126"
                      x2="187"
                      y2="152"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <line
                      x1="187"
                      y1="126"
                      x2="159"
                      y2="152"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                  </g>
                </>
              )}

              {eyeState === 'blinking' && (
                <>
                  {/* Left Blink Closed Eyelid */}
                  <line
                    x1="94"
                    y1="139"
                    x2="120"
                    y2="139"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-primary"
                  />

                  {/* Right Blink Closed Eyelid */}
                  <line
                    x1="160"
                    y1="139"
                    x2="186"
                    y2="139"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-primary"
                  />
                </>
              )}

              {eyeState === 'glancing' && (
                <>
                  {/* Left Curious Glimpse Eye */}
                  <g className="text-primary transition-transform duration-75 ease-out">
                    <circle
                      cx={107 + eyeOffset.x}
                      cy={139 + eyeOffset.y}
                      r="16"
                      fill="currentColor"
                    />
                    {/* Primary Catchlight */}
                    <circle
                      cx={103 + eyeOffset.x}
                      cy={134 + eyeOffset.y}
                      r="5.5"
                      fill="#FFFFFF"
                    />
                    {/* Secondary Catchlight */}
                    <circle
                      cx={112 + eyeOffset.x}
                      cy={143 + eyeOffset.y}
                      r="2.2"
                      fill="#FFFFFF"
                    />
                  </g>

                  {/* Right Curious Glimpse Eye */}
                  <g className="text-primary transition-transform duration-75 ease-out">
                    <circle
                      cx={173 + eyeOffset.x}
                      cy={139 + eyeOffset.y}
                      r="16"
                      fill="currentColor"
                    />
                    {/* Primary Catchlight */}
                    <circle
                      cx={169 + eyeOffset.x}
                      cy={134 + eyeOffset.y}
                      r="5.5"
                      fill="#FFFFFF"
                    />
                    {/* Secondary Catchlight */}
                    <circle
                      cx={178 + eyeOffset.x}
                      cy={143 + eyeOffset.y}
                      r="2.2"
                      fill="#FFFFFF"
                    />
                  </g>
                </>
              )}

              {/* Cheek Blush Indicators (Brighter when glancing at user) */}
              <ellipse
                cx="107"
                cy="164"
                rx="7"
                ry="3"
                fill="currentColor"
                opacity={eyeState === 'glancing' ? '0.36' : '0.18'}
                className="transition-opacity duration-300"
              />
              <ellipse
                cx="173"
                cy="164"
                rx="7"
                ry="3"
                fill="currentColor"
                opacity={eyeState === 'glancing' ? '0.36' : '0.18'}
                className="transition-opacity duration-300"
              />
            </svg>
          </div>

          {/* Synchronized Pulsing Shadow Underneath Mascot */}
          <div className="animate-shadow-pulse mx-auto mt-2 h-4 w-44 sm:w-56 md:w-64 rounded-full bg-primary/25 blur-lg dark:bg-primary/35" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="mt-3.5 text-xs sm:text-sm md:text-base leading-relaxed text-muted-foreground max-w-md sm:max-w-lg">
          {subtitle}
        </p>

        {/* Main CTA Button */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
          >
            Get back to Homepage
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>

          {showBackAction && (
            <button
              onClick={() => router.back()}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-muted hover:border-border active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              Previous Page
            </button>
          )}
        </div>

        {/* Quick Navigation Shortcuts */}
        {showQuickLinks && (
          <div className="mt-10 pt-6 border-t border-border/40 w-full">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Explore your study space
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground hover:bg-card"
              >
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                Study Library
              </Link>
              <Link
                href="/new"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground hover:bg-card"
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                Create Quiz
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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

  const eyeStateRef = useRef<EyeState>('dizzy');
  eyeStateRef.current = eyeState;

  const isInteractingRef = useRef<boolean>(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const naturalBlinkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Wake robot up into glancing state
  const wakeAndGlance = useCallback(() => {
    if (eyeStateRef.current === 'dizzy') {
      setEyeState('blinking');
      setTimeout(() => {
        setEyeState('glancing');
      }, 100);
    } else if (eyeStateRef.current === 'blinking') {
      setEyeState('glancing');
    }
  }, []);

  // Handle pointer tracking across the screen
  const handlePointerMove = useCallback((e: PointerEvent | React.PointerEvent) => {
    isInteractingRef.current = true;

    // Wake robot up immediately if currently dizzy
    if (eyeStateRef.current === 'dizzy') {
      wakeAndGlance();
    }

    if (mascotRef.current) {
      const rect = mascotRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate direction relative to viewport
      const dx = (e.clientX - centerX) / (window.innerWidth * 0.45);
      const dy = (e.clientY - centerY) / (window.innerHeight * 0.45);

      const clampedX = Math.max(-1, Math.min(1, dx));
      const clampedY = Math.max(-1, Math.min(1, dy));

      setEyeOffset({
        x: Number((clampedX * 7.5).toFixed(2)),
        y: Number((clampedY * 6).toFixed(2)),
      });
    }

    // Reset idle timeout: after 2.6s without movement, blink back to dizzy sleep
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      isInteractingRef.current = false;
      setEyeState('blinking');
      setTimeout(() => {
        setEyeState('dizzy');
        setEyeOffset({ x: 0, y: 0 });
      }, 130);
    }, 2600);
  }, [wakeAndGlance]);

  // Window-wide pointer tracking so mascot catches glimpse of user anywhere on screen
  useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      handlePointerMove(e);
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [handlePointerMove]);

  // Periodic natural blink while actively watching the user
  useEffect(() => {
    naturalBlinkIntervalRef.current = setInterval(() => {
      if (eyeStateRef.current === 'glancing') {
        setEyeState('blinking');
        setTimeout(() => {
          if (isInteractingRef.current) {
            setEyeState('glancing');
          }
        }, 110);
      }
    }, 3800);

    return () => {
      if (naturalBlinkIntervalRef.current) clearInterval(naturalBlinkIntervalRef.current);
    };
  }, []);

  // Autonomous peek loop when completely idle (e.g. touch/keyboard or stationary user)
  useEffect(() => {
    const runAutoLoop = () => {
      autoLoopTimeoutRef.current = setTimeout(() => {
        if (!isInteractingRef.current && eyeStateRef.current === 'dizzy') {
          // Wake up briefly to check room
          setEyeState('blinking');
          setTimeout(() => {
            setEyeState('glancing');
            setEyeOffset({ x: 0, y: 1 });
            setTimeout(() => {
              setEyeState('blinking');
              setTimeout(() => {
                setEyeState('dizzy');
                setEyeOffset({ x: 0, y: 0 });
                runAutoLoop();
              }, 120);
            }, 1800);
          }, 110);
        } else {
          runAutoLoop();
        }
      }, 5000);
    };

    runAutoLoop();

    return () => {
      if (autoLoopTimeoutRef.current) clearTimeout(autoLoopTimeoutRef.current);
    };
  }, []);

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
        {/* Enlarged Robot 404 Mascot with Gaze Tracking Eyes */}
        <div
          ref={mascotRef}
          className="relative mb-8 flex flex-col items-center group cursor-default"
        >
          <div className="animate-float-slow transition-transform hover:scale-105 duration-300 ease-out">
            <svg
              viewBox="0 0 280 250"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-52 w-52 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80 text-primary drop-shadow-2xl transition-colors duration-300"
              role="img"
              aria-label="404 Dizzy Robot Mascot that tracks cursor and blinks"
            >
              {/* Antenna Ping Wave (radiates when watching the user) */}
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
                  {/* Left Curious Glimpse Eye (Glides following cursor) */}
                  <g
                    className="text-primary"
                    style={{
                      transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                      transition: 'transform 80ms ease-out',
                    }}
                  >
                    <circle cx="107" cy="139" r="16" fill="currentColor" />
                    {/* Primary Catchlight */}
                    <circle cx="103" cy="134" r="5.5" fill="#FFFFFF" />
                    {/* Secondary Catchlight */}
                    <circle cx="112" cy="143" r="2.2" fill="#FFFFFF" />
                  </g>

                  {/* Right Curious Glimpse Eye (Glides following cursor) */}
                  <g
                    className="text-primary"
                    style={{
                      transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                      transition: 'transform 80ms ease-out',
                    }}
                  >
                    <circle cx="173" cy="139" r="16" fill="currentColor" />
                    {/* Primary Catchlight */}
                    <circle cx="169" cy="134" r="5.5" fill="#FFFFFF" />
                    {/* Secondary Catchlight */}
                    <circle cx="178" cy="143" r="2.2" fill="#FFFFFF" />
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
                href="/library"
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

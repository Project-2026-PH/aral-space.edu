'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Plus, ThumbsUp, AlertCircle, Smile, Heart, Eye } from 'lucide-react';

interface EditorialHeroGridProps {
  onOpenAiModal?: () => void;
}

// Zero-gravity physics draggable component using direct DOM transforms for 60fps performance
function ZeroGravityItem({
  children,
  className = '',
  initialX = 0,
  initialY = 0,
  initialRot = 0,
  containerRef,
  floatPhase = 0,
  disableBoundaryBounce = false,
}: {
  children: React.ReactNode;
  className?: string;
  initialX?: number;
  initialY?: number;
  initialRot?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  floatPhase?: number;
  disableBoundaryBounce?: boolean;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: initialX, y: initialY, rot: initialRot });
  const velRef = useRef({ vx: 0, vy: 0, vRot: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, itemStartX: 0, itemStartY: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const [isGrabbed, setIsGrabbed] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsGrabbed(true);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      itemStartX: posRef.current.x,
      itemStartY: posRef.current.y,
    };

    lastPointerRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };

    velRef.current = { vx: 0, vy: 0, vRot: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const now = performance.now();
    const dt = Math.max(1, now - lastPointerRef.current.time);
    const deltaPointerX = e.clientX - lastPointerRef.current.x;
    const deltaPointerY = e.clientY - lastPointerRef.current.y;

    // Calculate throw velocity smoothed over time (slow, gentle space inertia)
    const instantVx = (deltaPointerX / dt) * 3.5;
    const instantVy = (deltaPointerY / dt) * 3.5;
    velRef.current.vx = velRef.current.vx * 0.5 + instantVx * 0.5;
    velRef.current.vy = velRef.current.vy * 0.5 + instantVy * 0.5;
    velRef.current.vRot = Math.max(-3, Math.min(3, velRef.current.vx * 0.3));

    lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };

    // Direct drag displacement
    const newX = dragStartRef.current.itemStartX + (e.clientX - dragStartRef.current.startX);
    const newY = dragStartRef.current.itemStartY + (e.clientY - dragStartRef.current.startY);

    posRef.current.x = newX;
    posRef.current.y = newY;
    posRef.current.rot = initialRot + Math.max(-10, Math.min(10, velRef.current.vx * 0.8));

    if (itemRef.current) {
      itemRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0) rotate(${posRef.current.rot}deg)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsGrabbed(false);

    // Clamp launch speed to gentle space drift
    velRef.current.vx = Math.max(-5, Math.min(5, velRef.current.vx));
    velRef.current.vy = Math.max(-5, Math.min(5, velRef.current.vy));

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { }
  };

  // Zero-Gravity Simulation Loop (Slow momentum drift, space friction, boundary bounce, gentle ambient float)
  useEffect(() => {
    let animId: number;
    let clock = floatPhase;

    const updatePhysics = () => {
      clock += 0.008; // Slower time step for calm space floating

      if (!isDraggingRef.current) {
        const { vx, vy, vRot } = velRef.current;
        const speed = Math.hypot(vx, vy);

        // 1. Apply gentle velocity
        posRef.current.x += vx;
        posRef.current.y += vy;
        posRef.current.rot += vRot;

        // 2. Space damping (gradual deceleration)
        velRef.current.vx *= 0.95;
        velRef.current.vy *= 0.95;
        velRef.current.vRot *= 0.92;

        // 3. Ambient zero-gravity floating wave when calm (slow, serene bobbing)
        if (speed < 1.0) {
          const ambientY = Math.sin(clock) * 0.25;
          const ambientX = Math.cos(clock * 0.7) * 0.15;
          posRef.current.x += ambientX;
          posRef.current.y += ambientY;
          posRef.current.rot = initialRot + Math.sin(clock * 0.4) * 1.5;
        }

        // 4. Soft boundary bounce within canvas container
        if (!disableBoundaryBounce && containerRef.current && itemRef.current) {
          const cRect = containerRef.current.getBoundingClientRect();
          const iRect = itemRef.current.getBoundingClientRect();

          const margin = 10;
          if (iRect.left < cRect.left + margin && velRef.current.vx < 0) {
            velRef.current.vx = Math.abs(velRef.current.vx) * 0.5 + 0.2;
            velRef.current.vRot = -velRef.current.vRot * 0.5;
          } else if (iRect.right > cRect.right - margin && velRef.current.vx > 0) {
            velRef.current.vx = -Math.abs(velRef.current.vx) * 0.5 - 0.2;
            velRef.current.vRot = -velRef.current.vRot * 0.5;
          }

          if (iRect.top < cRect.top + margin && velRef.current.vy < 0) {
            velRef.current.vy = Math.abs(velRef.current.vy) * 0.5 + 0.2;
          } else if (iRect.bottom > cRect.bottom - margin && velRef.current.vy > 0) {
            velRef.current.vy = -Math.abs(velRef.current.vy) * 0.5 - 0.2;
          }
        }

        // Apply updated transform
        if (itemRef.current) {
          itemRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0) rotate(${posRef.current.rot}deg)`;
        }
      }

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [containerRef, disableBoundaryBounce, floatPhase, initialRot]);

  return (
    <div
      ref={itemRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translate3d(${initialX}px, ${initialY}px, 0) rotate(${initialRot}deg)`,
        touchAction: 'none',
      }}
      className={`cursor-grab active:cursor-grabbing select-none transition-shadow ${isGrabbed ? 'z-50 scale-110 !shadow-2xl ring-2 ring-primary/40' : 'z-20'
        } ${className}`}
    >
      {children}
    </div>
  );
}

export default function EditorialHeroGrid({ onOpenAiModal }: EditorialHeroGridProps) {
  const spaceCanvasRef = useRef<HTMLDivElement>(null);

  return (
    <section className="relative w-full border-b-2 border-slate-900/80 dark:border-white/30 bg-[#fafafa] dark:bg-[#0c0f1d] overflow-hidden">
      {/* Full-Width Editorial Bento Grid Layout */}
      <div className="relative grid grid-cols-1 lg:grid-cols-12 w-full min-h-[calc(100vh-4rem)]">

        {/* ================= LEFT COLUMN (7 COLS): EDITORIAL HERO ================= */}
        <div className="order-2 lg:order-1 lg:col-span-7 flex flex-col justify-between border-t-2 lg:border-t-0 lg:border-r-2 border-slate-900/80 dark:border-white/30 bg-white dark:bg-[#0c0f1d]">

          {/* Top Cell: Hero Headline, Subhead & Action Buttons */}
          <div className="relative p-8 sm:p-12 md:p-16 lg:p-20 xl:p-24 flex-1 flex flex-col justify-center overflow-hidden">
            <div className="relative z-10 space-y-6 max-w-2xl">
              <h1 className="text-3xl sm:text-5xl md:text-6xl xl:text-7xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.08]">
                Not sure how to master your exam handouts?
              </h1>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium max-w-xl leading-relaxed">
                Convert heavy lecture notes into smart reviewers and flashcard decks in just a few seconds.
              </p>
            </div>
          </div>

          {/* Bottom Row: 3 Feature Cells */}
          <div className="grid grid-cols-1 sm:grid-cols-3 border-t-2 border-slate-900/80 dark:border-white/30 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-900/80 dark:divide-white/30 bg-white dark:bg-[#101526]">

            {/* Feature Cell 1: Quick Start */}
            <div className="p-6 space-y-2 flex flex-col justify-between">
              <div>
                <span className="inline-block text-lg font-black text-blue-600 dark:text-blue-400 mb-1">
                  1
                </span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                  Turn lecture notes into flashcards and quizzes.
                </p>
              </div>
              <div className="w-full h-0.5 bg-slate-900/30 dark:bg-white/20 mt-3" />
            </div>

            {/* Feature Cell 2: Local-first Philosophy */}
            <div className="p-6 space-y-2 flex flex-col justify-between">
              <div>
                <span className="inline-block text-lg font-black text-blue-600 dark:text-blue-400 mb-1">
                  2
                </span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                  No accounts, no logins. Everything stays private on your device.
                </p>
              </div>
              <div className="w-full h-0.5 bg-slate-900/30 dark:bg-white/20 mt-3" />
            </div>

            {/* Feature Cell 3: Graphic Stamp & Copyright */}
            <div className="p-6 flex items-center justify-between">
              <div className="w-12 h-16 rounded-full bg-[#2563eb] border-2 border-slate-900 flex items-center justify-center shadow-brutal-sm">
                <span className="text-2xl font-black text-white">A</span>
              </div>

              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-600 dark:text-slate-400 rotate-90 origin-center whitespace-nowrap">
                © 2026/ARAL///
              </span>
            </div>

          </div>

        </div>


        {/* Desktop Seam Bookmark Tab: ARAL SPACE (Positioned on the vertical divider border, compact) */}
        <div className="hidden lg:flex absolute left-[58.333333%] top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 items-center justify-center pointer-events-none">
          <span className="inline-flex items-center justify-center bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 border-2 border-slate-900 dark:border-white/80 -rotate-90 shadow-brutal-sm rounded whitespace-nowrap leading-none">
            Aral Space
          </span>
        </div>

        {/* ================= RIGHT COLUMN (5 COLS): OUTER SPACE ZERO-GRAVITY CANVAS ================= */}
        <div
          ref={spaceCanvasRef}
          className="order-1 lg:order-2 lg:col-span-5 relative flex items-center justify-center p-8 sm:p-14 min-h-[460px] sm:min-h-[520px] lg:min-h-full bg-slate-50/70 dark:bg-slate-950/40 overflow-hidden border-b-2 lg:border-b-0 border-slate-900/80 dark:border-white/30"
        >
          {/* Mobile Seam Tag: Slim & compact inside canvas, never sliced off */}
          <div className="lg:hidden absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <span className="inline-flex items-center justify-center bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 border-2 border-slate-900 dark:border-white/80 shadow-brutal-sm rounded whitespace-nowrap leading-none">
              Aral Space
            </span>
          </div>

          {/* ============ ZERO-GRAVITY DRAGGABLE SPACE ELEMENTS ============ */}

          {/* Top Left: Polaroid Eyes Sticker */}
          <ZeroGravityItem
            containerRef={spaceCanvasRef}
            initialRot={-8}
            floatPhase={1.2}
            className="absolute top-12 left-10 hidden sm:block"
          >
            <div className="w-16 h-20 bg-white border-2 border-slate-900 p-2 rounded-xl shadow-brutal-sm flex flex-col items-center justify-center hover:rotate-3 transition-transform">
              <div className="flex items-center gap-1.5 text-slate-900">
                <Eye className="w-4 h-4" />
                <Eye className="w-4 h-4" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-600 mt-2">study</span>
            </div>
          </ZeroGravityItem>

          {/* Top Center: Atomic Orbit with Blue Heart */}
          <ZeroGravityItem
            containerRef={spaceCanvasRef}
            initialRot={14}
            floatPhase={2.8}
            className="absolute top-8 left-1/2 -translate-x-1/2 hidden sm:block"
          >
            <div className="relative w-22 h-12 border-2 border-dashed border-blue-600/60 dark:border-blue-400/60 rounded-full flex items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-xs shadow-brutal-sm">
              <Heart className="w-5 h-5 text-blue-600 fill-blue-600" />
            </div>
          </ZeroGravityItem>

          {/* Top Right: Blue & White Smiley Badge */}
          <ZeroGravityItem
            containerRef={spaceCanvasRef}
            initialRot={12}
            floatPhase={0.4}
            className="absolute top-8 right-12"
          >
            <div className="w-13 h-13 rounded-full bg-blue-500 border-2 border-slate-900 flex items-center justify-center shadow-brutal-sm hover:scale-110 transition-transform">
              <Smile className="w-8 h-8 text-white" />
            </div>
          </ZeroGravityItem>

          {/* Big Blue Orbit Planet in background */}
          <ZeroGravityItem
            containerRef={spaceCanvasRef}
            initialRot={0}
            floatPhase={4.1}
            className="absolute -top-10 -right-10 pointer-events-auto"
          >
            <div className="w-40 h-40 rounded-full bg-blue-600/25 dark:bg-blue-500/15 border-2 border-blue-900/40 opacity-90 shadow-brutal-sm" />
          </ZeroGravityItem>

          {/* Blue Sparkles Flower on Left */}
          <ZeroGravityItem
            containerRef={spaceCanvasRef}
            initialRot={-12}
            floatPhase={3.3}
            className="absolute top-36 left-6 hidden sm:block"
          >
            <div className="w-14 h-14 bg-white dark:bg-blue-950 border-2 border-slate-900 rounded-2xl flex items-center justify-center shadow-brutal-sm hover:rotate-45 transition-transform">
              <Sparkles className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
          </ZeroGravityItem>

          {/* ============ CENTERPIECE: MP4 ANIMATION (STATIC ANCHOR) ============ */}
          <div className="relative z-10 flex flex-col items-center my-6 select-none pointer-events-auto">
            <div className="relative rounded-3xl border-3 border-slate-900 shadow-brutal overflow-hidden bg-white dark:bg-black transition-transform duration-300 hover:scale-[1.02]">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-80 lg:h-80 object-cover pointer-events-none"
              >
                <source src="/aral-animation.mp4" type="video/mp4" />
              </video>
            </div>
          </div>

          {/* Bottom Left: Blue Thumbs Up Badge */}
          <ZeroGravityItem
            containerRef={spaceCanvasRef}
            initialRot={-10}
            floatPhase={1.9}
            className="absolute bottom-10 left-8"
          >
            <div className="bg-[#2563eb] border-2 border-slate-900 text-white p-3 rounded-2xl shadow-brutal-sm flex items-center gap-1.5 hover:scale-115 transition-transform">
              <ThumbsUp className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </ZeroGravityItem>

          {/* Bottom Center: Exclamation Bubble & 100% LOCAL Stamp */}
          <ZeroGravityItem
            containerRef={spaceCanvasRef}
            initialRot={-4}
            floatPhase={2.2}
            className="absolute bottom-8 left-1/3 flex items-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-900 flex items-center justify-center shadow-brutal-sm">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" strokeWidth={3} />
            </div>
            <span className="bg-white border-2 border-slate-900 text-slate-900 text-xs font-black px-3 py-1 rounded-lg shadow-brutal-sm">
              TARA ARAL
            </span>
          </ZeroGravityItem>

          {/* Bottom Right: Blue Starburst Sticker & FREE Stamp */}
          <ZeroGravityItem
            containerRef={spaceCanvasRef}
            initialRot={8}
            floatPhase={3.7}
            className="absolute bottom-10 right-8 flex items-center gap-2"
          >
            <div className="w-12 h-12 bg-[#0284c7] border-2 border-slate-900 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-brutal-sm">
              ✦
            </div>
            <span className="bg-[#1d4ed8] border-2 border-slate-900 text-white text-xs font-black px-3 py-1 rounded-lg shadow-brutal-sm rotate-6">
              FOR YOU
            </span>
          </ZeroGravityItem>

        </div>

      </div>
    </section>
  );
}


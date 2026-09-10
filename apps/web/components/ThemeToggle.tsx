'use client';

import React, { useEffect, useState } from 'react';
import { LampDesk } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasDarkClass = document.documentElement.classList.contains('dark');
    const localTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = localTheme === 'dark' || (!localTheme && (hasDarkClass || prefersDark));

    if (isDark) {
      document.documentElement.classList.add('dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  if (!mounted) {
    return (
      <div
        className="h-8 w-8 rounded-full border border-border/80 bg-card/80 opacity-0"
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="group relative flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-card/80 text-muted-foreground backdrop-blur-md transition-all shadow-2xs hover:border-primary/50 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 cursor-pointer"
      aria-label={theme === 'dark' ? 'Switch to light mode (turn lamp off)' : 'Switch to dark mode (turn lamp on)'}
      title={theme === 'dark' ? 'Switch to light mode (turn lamp off)' : 'Switch to dark mode (turn lamp on)'}
    >
      {/* Subtle warm yellow ambient glow in dark mode */}
      {theme === 'dark' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-0.5 inset-x-1.5 h-4.5 rounded-full bg-amber-400/20 blur-[5px] transition-opacity duration-300"
        />
      )}

      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:scale-110"
      >
        {/* Glowing light cone and downward radiance (illuminated only when dark mode is on) */}
        {theme === 'dark' && (
          <g className="animate-in fade-in duration-200">
            {/* Soft downward light cone */}
            <path
              d="M4.5 17.5 L1.5 23.5 h21 L19.5 17.5 Z"
              fill="#fbbf24"
              fillOpacity="0.22"
              stroke="none"
            />
            {/* Radiant light rays */}
            <line x1="12" y1="20.5" x2="12" y2="23" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.95" />
            <line x1="8" y1="20" x2="6" y2="22" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <line x1="16" y1="20" x2="18" y2="22" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            {/* Warm glowing bulb under shade */}
            <rect x="10.5" y="17.5" width="3" height="2.5" rx="1.2" fill="#fde047" stroke="#f59e0b" strokeWidth="0.5" />
          </g>
        )}

        {/* Hanging Pendant Lamp Structure - Matches the reference illustration */}
        <g stroke="currentColor" className={theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}>
          {/* Ceiling mount bar */}
          <path d="M8.5 2.5h7" />
          
          {/* Cord / hanging rod */}
          <path d="M12 2.5v6" />
          
          {/* Rounded dome socket cap */}
          <path d="M10 11.5v-1a2 2 0 0 1 4 0v1" />
          
          {/* Wide triangular lampshade */}
          <path
            d="M4.8 17.5 L9.6 11.5 h4.8 l4.8 6 c.4.5.1 1.2-.6 1.2 H5.4 c-.7 0-1-.7-.6-1.2 Z"
            fill={theme === 'dark' ? '#1e293b' : 'none'}
          />
          
          {/* Glossy diagonal highlight slit on the shade */}
          <path d="M8.5 15.5 L10.5 13.5" />

          {/* Bulb peeking underneath (when unlit in light mode) */}
          {theme !== 'dark' && (
            <path d="M10.5 18.7 v1 a1.5 1.5 0 0 0 3 0 v-1" />
          )}
        </g>
      </svg>
    </button>
  );
}

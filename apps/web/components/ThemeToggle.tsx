'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const transitionFrameRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

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

    return () => {
      if (transitionFrameRef.current !== null) {
        cancelAnimationFrame(transitionFrameRef.current);
      }
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
      overlayRef.current?.remove();
      overlayRef.current = null;
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;

    if (transitionFrameRef.current !== null) {
      cancelAnimationFrame(transitionFrameRef.current);
    }
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
    }
    overlayRef.current?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'theme-fade-overlay';
    overlay.style.backgroundColor = nextTheme === 'dark'
      ? 'hsl(224 25% 9%)'
      : 'hsl(30 20% 98%)';
    document.body.appendChild(overlay);
    overlayRef.current = overlay;

    // Avoid animating every themed element while the root theme class changes.
    root.classList.add('theme-changing');
    setTheme(nextTheme);
    root.classList.toggle('dark', nextTheme === 'dark');
    localStorage.setItem('theme', nextTheme);

    requestAnimationFrame(() => {
      overlay.classList.add('is-fading');
    });

    fadeTimerRef.current = window.setTimeout(() => {
      overlay.remove();
      if (overlayRef.current === overlay) {
        overlayRef.current = null;
        fadeTimerRef.current = null;
      }
    }, 420);

    transitionFrameRef.current = requestAnimationFrame(() => {
      transitionFrameRef.current = requestAnimationFrame(() => {
        root.classList.remove('theme-changing');
        transitionFrameRef.current = null;
      });
    });
  };

  if (!mounted) {
    return (
      <div
        className="h-6 w-17 opacity-0"
        aria-hidden="true"
      />
    );
  }

  return (
    <label
      className="ui-switch"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <input
        type="checkbox"
        checked={theme === 'dark'}
        onChange={toggleTheme}
        aria-label="Toggle dark mode"
      />
      <div className="slider">
        <span className="slider-label-dark" aria-hidden="true">Dark</span>
        <span className="slider-label-light" aria-hidden="true">Light</span>
        <div className="circle">
          <Sun className={`h-3.5 w-3.5 text-white transition-all duration-400 absolute ${theme === 'dark' ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'}`} />
          <Moon className={`h-3.5 w-3.5 text-white transition-all duration-400 absolute ${theme === 'dark' ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`} />
        </div>
      </div>
    </label>
  );
}

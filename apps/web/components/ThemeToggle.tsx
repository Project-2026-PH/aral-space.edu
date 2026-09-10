'use client';

import React, { useEffect, useState } from 'react';

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
        <div className="circle" />
      </div>
    </label>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Heart, Github, X, ExternalLink, GraduationCap, Calendar } from 'lucide-react';

interface GitHubProfile {
  username: string;
  name: string;
  avatar_url: string;
  html_url: string;
}

interface DeveloperConfig {
  username: string;
  defaultName: string;
  cardBg: string;
  badgeBg: string;
  stickerBg: string;
  hoverBorder: string;
  accentText: string;
  buttonHover: string;
}

const DEVELOPERS: DeveloperConfig[] = [
  {
    username: 'aelanimm',
    defaultName: 'Aela',
    // Pink theme for Aela
    cardBg: 'bg-[#fff1f5] dark:bg-[#25121b]',
    badgeBg: 'bg-pink-500 text-white',
    stickerBg: 'bg-pink-300 text-slate-900 border-slate-900',
    hoverBorder: 'hover:border-pink-500',
    accentText: 'text-pink-600 dark:text-pink-400',
    buttonHover: 'hover:bg-pink-50 dark:hover:bg-pink-950/40 hover:text-pink-600 dark:hover:text-pink-400',
  },
  {
    username: 'primooo05',
    defaultName: 'Primo',
    // Red theme for Primo
    cardBg: 'bg-[#fef2f2] dark:bg-[#271212]',
    badgeBg: 'bg-rose-600 text-white',
    stickerBg: 'bg-rose-300 text-slate-900 border-slate-900',
    hoverBorder: 'hover:border-rose-600',
    accentText: 'text-rose-600 dark:text-rose-400',
    buttonHover: 'hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400',
  },
];

export default function DevelopersModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };
  const [profiles, setProfiles] = useState<Record<string, GitHubProfile>>({
    aelanimm: {
      username: 'aelanimm',
      name: 'Aela',
      avatar_url: 'https://github.com/aelanimm.png',
      html_url: 'https://github.com/aelanimm',
    },
    primooo05: {
      username: 'primooo05',
      name: 'Primo',
      avatar_url: 'https://github.com/primooo05.png',
      html_url: 'https://github.com/primooo05',
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    DEVELOPERS.forEach(async ({ username, defaultName }) => {
      try {
        const res = await fetch(`https://api.github.com/users/${username}`);
        if (!res.ok) return;
        const data = await res.json();
        setProfiles((prev) => ({
          ...prev,
          [username]: {
            username,
            name: data.name || defaultName,
            avatar_url: data.avatar_url || `https://github.com/${username}.png`,
            html_url: data.html_url || `https://github.com/${username}`,
          },
        }));
      } catch {
        // Fallback already prefilled
      }
    });
  }, [isOpen]);

  return (
    <>
      {/* Clickable trigger in footer */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group cursor-pointer"
      >
        <Heart className="w-4 h-4 text-blue-600 fill-blue-600 group-hover:scale-125 transition-transform duration-200 animate-pulse" />
        <span className="underline underline-offset-4 decoration-slate-300 dark:decoration-slate-700 group-hover:decoration-blue-500">
          About Developers
        </span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          onClick={handleClose}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto ${
            isClosing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'
          }`}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-lg rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-[#0c0f1d] p-6 sm:p-7 shadow-brutal space-y-6 text-slate-900 dark:text-white my-8 ${
              isClosing ? 'animate-modal-pop-out' : 'animate-modal-pop'
            } will-change-transform`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900/15 dark:border-white/15 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-brutal-sm border border-slate-900">
                  <Heart className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">About Developers</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Built with care for students</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Top metadata badge strip: Current Year & Created Year */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-900/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold block leading-none">Created</span>
                  <span className="font-black text-slate-900 dark:text-white">Year 2026</span>
                </div>
              </div>

              <div className="h-6 w-px bg-blue-200 dark:bg-blue-800/60 hidden sm:block" />

              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold block leading-none">Now in</span>
                  <span className="font-black text-slate-900 dark:text-white">Year 2026</span>
                </div>
              </div>

              <div className="h-6 w-px bg-blue-200 dark:bg-blue-800/60 hidden sm:block" />

              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <GraduationCap className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold block leading-none">Standing</span>
                  <span className="font-black text-amber-700 dark:text-amber-400">4th Year Students</span>
                </div>
              </div>
            </div>

            {/* Developer Collectible Cards in vertical layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DEVELOPERS.map((dev) => {
                const profile = profiles[dev.username];
                return (
                  <div
                    key={dev.username}
                    className={`relative rounded-3xl border-3 border-slate-900 dark:border-white/40 ${dev.cardBg} p-5 shadow-brutal flex flex-col justify-between overflow-hidden group hover:-translate-y-1 transition-transform duration-200`}
                  >
                    {/* Floating Sticker / Tag */}
                    <div className="absolute top-3.5 right-3.5 z-10 rotate-3 group-hover:rotate-6 transition-transform">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${dev.stickerBg} text-[10px] font-black uppercase tracking-wider border-2 shadow-brutal-xs`}>
                        <GraduationCap className="w-3 h-3 text-slate-900" />
                        4th Year Student
                      </span>
                    </div>

                    {/* Vertical card layout like collector's card */}
                    <div>
                      {/* Vertical side label */}
                      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 block mb-3">
                        DEVELOPER
                      </span>

                      {/* Large Centered Illustration / Avatar */}
                      <div className="flex justify-center py-2">
                        <div className="relative">
                          <img
                            src={profile.avatar_url}
                            alt={profile.name}
                            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-3 border-slate-900 dark:border-white/30 object-cover shadow-brutal-sm bg-white"
                            onError={(e) => {
                              // fallback to dicebear
                              e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${dev.username}`;
                            }}
                          />
                          {/* Mini sticker pill under avatar */}
                          <div className={`absolute -bottom-2 -left-2 ${dev.badgeBg} text-[9px] font-black px-2 py-0.5 rounded-md border border-slate-900 shadow-xs uppercase tracking-wide`}>
                            STUDENT DEV
                          </div>
                        </div>
                      </div>

                      {/* Card Info */}
                      <div className="mt-4 pt-3 border-t-2 border-slate-900/10 dark:border-white/10 text-left space-y-1">
                        <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                          {profile.name}
                        </h4>
                        <p className={`text-[11px] font-bold ${dev.accentText}`}>
                          @{dev.username}
                        </p>
                      </div>
                    </div>

                    {/* Socials: GITHUB ONLY */}
                    <div className="mt-4 pt-3 border-t-2 border-dashed border-slate-900/15 dark:border-white/15">
                      <a
                        href={profile.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-900 dark:border-white/20 shadow-brutal-xs ${dev.buttonHover} transition-all font-bold text-xs group/btn`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Github className="w-4 h-4 shrink-0 text-slate-900 dark:text-white group-hover/btn:text-current" />
                          <span className="truncate text-[11px]">github.com/{dev.username}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover/btn:opacity-100" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer close button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-black text-xs uppercase tracking-wider border-2 border-slate-900 shadow-brutal-sm transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

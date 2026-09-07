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
  avatarUrl: string;
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
    avatarUrl: 'https://avatars.githubusercontent.com/u/191355555?v=4',
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
    avatarUrl: 'https://avatars.githubusercontent.com/u/191092961?v=4',
    cardBg: 'bg-[#fef2f2] dark:bg-[#271212]',
    badgeBg: 'bg-rose-600 text-white',
    stickerBg: 'bg-rose-300 text-slate-900 border-slate-900',
    hoverBorder: 'hover:border-rose-600',
    accentText: 'text-rose-600 dark:text-rose-400',
    buttonHover: 'hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400',
  },
];

function createFallbackAvatarSvg(name: string, bg: string, text: string) {
  const initial = (name[0] || 'D').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="${bg}"/><text x="50" y="58" font-size="42" font-weight="900" font-family="system-ui, sans-serif" fill="${text}" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function DevelopersModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

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
      avatar_url: 'https://avatars.githubusercontent.com/u/191355555?v=4',
      html_url: 'https://github.com/aelanimm',
    },
    primooo05: {
      username: 'primooo05',
      name: 'Primo',
      avatar_url: 'https://avatars.githubusercontent.com/u/191092961?v=4',
      html_url: 'https://github.com/primooo05',
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    DEVELOPERS.forEach(async ({ username, defaultName, avatarUrl }) => {
      try {
        const res = await fetch(`https://api.github.com/users/${username}`, {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        setProfiles((prev) => ({
          ...prev,
          [username]: {
            username,
            name: data.name || defaultName,
            avatar_url: data.avatar_url || avatarUrl,
            html_url: data.html_url || `https://github.com/${username}`,
          },
        }));
      } catch {
        // Fallback prefilled
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
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs ${
            isClosing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'
          }`}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-lg rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-[#0c0f1d] p-4 sm:p-5 shadow-brutal space-y-3.5 text-slate-900 dark:text-white my-auto ${
              isClosing ? 'animate-modal-pop-out' : 'animate-modal-pop'
            } will-change-transform`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900/15 dark:border-white/15 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-brutal-xs border border-slate-900 shrink-0">
                  <Heart className="w-3.5 h-3.5 fill-white" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight leading-tight">About Developers</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Built with care for students</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close dialog"
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compact Top metadata badge strip */}
            <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Calendar className="w-3 h-3" />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-slate-500 dark:text-slate-400 font-medium block text-[9px]">Created</span>
                  <span className="font-black text-slate-900 dark:text-white text-[10px] truncate block">2026</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0 border-l border-blue-200 dark:border-blue-800/60 pl-1.5">
                <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Calendar className="w-3 h-3" />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-slate-500 dark:text-slate-400 font-medium block text-[9px]">Now</span>
                  <span className="font-black text-slate-900 dark:text-white text-[10px] truncate block">2026</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0 border-l border-blue-200 dark:border-blue-800/60 pl-1.5">
                <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <GraduationCap className="w-3 h-3" />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-slate-500 dark:text-slate-400 font-medium block text-[9px]">Standing</span>
                  <span className="font-black text-amber-700 dark:text-amber-400 text-[10px] truncate block">4th Year</span>
                </div>
              </div>
            </div>

            {/* Developer Collectible Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {DEVELOPERS.map((dev) => {
                const profile = profiles[dev.username] || {
                  username: dev.username,
                  name: dev.defaultName,
                  avatar_url: dev.avatarUrl,
                  html_url: `https://github.com/${dev.username}`,
                };
                const hasError = imgErrors[dev.username];
                const fallbackAvatar = createFallbackAvatarSvg(
                  profile.name,
                  dev.username === 'aelanimm' ? '#f472b6' : '#f43f5e',
                  '#ffffff'
                );

                return (
                  <div
                    key={dev.username}
                    className={`relative rounded-2xl border-2 sm:border-3 border-slate-900 dark:border-white/40 ${dev.cardBg} p-3 sm:p-3.5 shadow-brutal-sm flex flex-col justify-between overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200`}
                  >
                    {/* Floating Sticker / Tag */}
                    <div className="absolute top-2 right-2 z-10 rotate-2 group-hover:rotate-4 transition-transform">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${dev.stickerBg} text-[8px] font-black uppercase tracking-wider border shadow-brutal-xs`}>
                        <GraduationCap className="w-2.5 h-2.5 text-slate-900" />
                        4th Year
                      </span>
                    </div>

                    <div>
                      {/* Vertical side label */}
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block mb-1">
                        DEV
                      </span>

                      {/* Illustration / Avatar */}
                      <div className="flex justify-center py-1">
                        <div className="relative">
                          <img
                            src={hasError ? fallbackAvatar : (profile.avatar_url || dev.avatarUrl)}
                            alt={profile.name}
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            loading="eager"
                            className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl border-2 border-slate-900 dark:border-white/30 object-cover shadow-xs bg-white"
                            onError={() => {
                              setImgErrors((prev) => ({ ...prev, [dev.username]: true }));
                            }}
                          />
                          {/* Mini sticker pill under avatar */}
                          <div className={`absolute -bottom-1.5 -left-1.5 ${dev.badgeBg} text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded border border-slate-900 shadow-xs uppercase tracking-tight`}>
                            STUDENT
                          </div>
                        </div>
                      </div>

                      {/* Card Info */}
                      <div className="mt-2 pt-2 border-t border-slate-900/10 dark:border-white/10 text-left">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                          {profile.name}
                        </h4>
                        <p className={`text-[10px] font-bold ${dev.accentText} truncate leading-tight`}>
                          @{dev.username}
                        </p>
                      </div>
                    </div>

                    {/* Socials: GITHUB */}
                    <div className="mt-2.5 pt-2 border-t border-dashed border-slate-900/15 dark:border-white/15">
                      <a
                        href={profile.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-900 dark:border-white/20 shadow-xs ${dev.buttonHover} transition-all font-bold text-[10px] group/btn`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Github className="w-3.5 h-3.5 shrink-0 text-slate-900 dark:text-white group-hover/btn:text-current" />
                          <span className="truncate text-[10px]">@{dev.username}</span>
                        </div>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-70 group-hover/btn:opacity-100" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

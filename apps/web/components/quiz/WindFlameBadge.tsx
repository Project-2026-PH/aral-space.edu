'use client';

import React from 'react';

export interface WindFlameBadgeProps {
  streak: number;
  totalQuestions: number;
  size?: 'sm' | 'md' | 'lg';
  bestStreak?: number;
  showTooltip?: boolean;
}

export function getFlameTier(streak: number, totalQuestions: number) {
  // Map 1..totalQuestions across 5 color tiers:
  // 1: Orange, 2: Red Orange, 3: Red, 4: Violet, 5: Cyan
  const maxSpan = Math.max(1, totalQuestions - 1);
  const ratio = streak <= 0 ? 0 : Math.min(1, Math.max(0, (streak - 1) / maxSpan));
  const tierIndex = streak <= 0 ? 0 : Math.min(4, Math.floor(ratio * 5));

  const tiers = [
    {
      name: 'Orange Flame',
      tier: 1,
      body: '#FFC200',      // Sunny Golden Yellow (reference image)
      shadow: '#FF9F00',    // Warm Amber Left Shadow
      core: '#FF7A00',      // Tangerine Core Flame
      glint: '#FFF35C',     // Bright Lemon Specular Pill
      glow: 'rgba(255, 160, 0, 0.45)',
      windDuration: '2.2s',
      label: streak === 0 ? 'Kindling • Ready to Ignite' : 'Stage 1 • Warming Up'
    },
    {
      name: 'Red Orange Flame',
      tier: 2,
      body: '#FF6A00',      // Blazing Orange
      shadow: '#E65100',    // Deep Burnt Orange Shadow
      core: '#DD2C00',      // Fiery Lava Core
      glint: '#FFB078',     // Peach Glow Pill
      glow: 'rgba(255, 106, 0, 0.55)',
      windDuration: '1.7s',
      label: 'Stage 2 • Blazing Heat'
    },
    {
      name: 'Crimson Red Flame',
      tier: 3,
      body: '#FF2A55',      // Electric Crimson Red
      shadow: '#C2185B',    // Deep Berry Shadow
      core: '#880E4F',      // Dark Ruby Core
      glint: '#FF94A8',     // Rose Glint
      glow: 'rgba(255, 42, 85, 0.65)',
      windDuration: '1.3s',
      label: 'Stage 3 • Inferno Red'
    },
    {
      name: 'Violet Plasma Flame',
      tier: 4,
      body: '#9D4EDD',      // Electric Amethyst
      shadow: '#7209B7',    // Deep Purple Shadow
      core: '#560BAD',      // Dark Violet Core
      glint: '#E2B6FF',     // Lavender Glint
      glow: 'rgba(157, 78, 221, 0.7)',
      windDuration: '1.0s',
      label: 'Stage 4 • Violet Voltage'
    },
    {
      name: 'Supercharged Cyan Flame',
      tier: 5,
      body: '#00D2FF',      // Vivid Electric Cyan
      shadow: '#0096C7',    // Ocean Cobalt Shadow
      core: '#0077B6',      // Deep Sapphire Core
      glint: '#9CF0FF',     // Diamond Cyan Glint
      glow: 'rgba(0, 210, 255, 0.85)',
      windDuration: '0.8s',
      label: 'Stage 5 • Master Apex Cyan'
    }
  ];

  return tiers[tierIndex];
}

export default function WindFlameBadge({
  streak,
  totalQuestions,
  size = 'md',
  bestStreak,
  showTooltip = true
}: WindFlameBadgeProps) {
  const theme = getFlameTier(streak, totalQuestions);

  const dimensionMap = {
    sm: { width: 38, height: 44, font: 24, stroke: 7 },
    md: { width: 52, height: 60, font: 26, stroke: 8 },
    lg: { width: 72, height: 84, font: 28, stroke: 9 }
  };

  const { width, height, font, stroke } = dimensionMap[size] || dimensionMap.md;

  return (
    <div className="group relative inline-flex items-center justify-center select-none">
      <div
        className="flame-wind-animated relative flex items-center justify-center"
        style={
          {
            '--flame-duration': theme.windDuration,
            filter: `drop-shadow(0 4px 10px ${theme.glow})`
          } as React.CSSProperties
        }
      >
        <svg
          width={width}
          height={height}
          viewBox="0 0 100 115"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flame-gust-pulse overflow-visible"
        >
          <defs>
            {/* Soft shadow for center streak number */}
            <filter id={`numShadow-${size}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
            </filter>
          </defs>

          <path
            d="M 52 106
               C 26 106 14 90 14 66
               L 14 36
               C 14 26 23 20 31 26
               L 39 33
               C 41 35 44 34 45 32
               L 54 18
               C 58 11 67 11 71 18
               C 78 30 88 46 88 66
               C 88 92 74 106 52 106 Z"
            fill={theme.body}
            // stroke="#FFFFFF"
            strokeWidth={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ paintOrder: 'stroke fill' }}
          />

          {/* Left-Side Shadow Layer (matching image 2-tone shading) */}
          <path
            d="M 14 36
               C 14 26 23 20 31 26
               L 39 33
               C 41 35 43 34 44 33
               C 36 44 32 58 32 74
               C 32 86 36 96 42 104
               C 26 102 14 88 14 66
               Z"
            fill={theme.shadow}
            opacity="0.95"
          />

          {/* Center Inner Flame Teardrop */}
          <path
            d="M 50 50
               C 50 50 66 68 66 78
               C 66 88 58 94 50 94
               C 42 94 34 88 34 78
               C 34 68 50 50 50 50 Z"
            fill={theme.core}
          />

          {/* Top-Right Specular Pill Highlight (exact angle & shape from image) */}
          <ellipse
            cx="62"
            cy="35"
            rx="6"
            ry="14"
            transform="rotate(40 62 35)"
            fill={theme.glint}
          />

          {/* Center Streak Number */}
          <text
            x="50"
            y="85"
            textAnchor="middle"
            fontSize={font}
            fontWeight="900"
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
            fill="#FFFFFF"
            filter={`url(#numShadow-${size})`}
            className="select-none pointer-events-none tracking-tight"
          >
            {streak}
          </text>
        </svg>
      </div>

      {/* Hover Info Tooltip */}
      {showTooltip && (
        <div className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-xl bg-card border border-border px-2.5 py-1 text-[10px] font-bold text-foreground shadow-lg">
          <span>{theme.name}</span>
          <span className="text-muted-foreground ml-1">({theme.label})</span>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface RichTooltipProps {
  id: string;
  title: string;
  description: string;
  children: React.ReactElement;
}

interface TooltipPosition {
  top: number;
  left: number;
}

export default function RichTooltip({ id, title, description, children }: RichTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useEffect(() => {
    if (!visible) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const rootZoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      setPosition({
        top: (rect.top - 6) / rootZoom,
        left: (rect.left + rect.width / 2) / rootZoom
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible]);

  if (!isValidElement(children)) return children;

  const trigger = cloneElement(
    children as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
    { 'aria-describedby': id }
  );

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {trigger}
      {visible && position && createPortal(
        <div
          id={id}
          role="tooltip"
          className="pointer-events-none fixed z-[100] w-max max-w-64 -translate-x-1/2 -translate-y-full rounded-lg border-2 border-slate-900 bg-slate-900 px-2.5 py-1.5 text-left text-[10px] font-black leading-tight text-white shadow-brutal-sm"
          style={{ top: position.top, left: position.left }}
        >
          <span className="block text-xs">{title}</span>
          <span className="mt-0.5 block font-bold text-slate-300">{description}</span>
        </div>,
        document.body
      )}
    </span>
  );
}

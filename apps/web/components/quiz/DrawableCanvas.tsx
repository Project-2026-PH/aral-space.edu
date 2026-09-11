'use client';

import { type PointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Eraser, Highlighter, PenTool, Pipette, Plus, Trash2, Undo2 } from 'lucide-react';

export type DrawingTool = 'pen' | 'marker' | 'eraser';

type DrawingPoint = {
  x: number;
  y: number;
};

type DrawingStroke = {
  points: DrawingPoint[];
  color: string;
  size: number;
  alpha?: number;
  tool: DrawingTool;
};

type DrawingSnapshot = {
  version: number;
  strokes: DrawingStroke[];
};

type HsvColor = {
  hue: number;
  saturation: number;
  value: number;
};

interface DrawableCanvasProps {
  active: boolean;
  storageKey: string;
  containerRef?: RefObject<HTMLElement | null>;
  onExit: () => void;
}

interface ColorPickerPopoverProps {
  color: string;
  hue: number;
  saturation: number;
  value: number;
  alpha: number;
  hexInput: string;
  savedColors: string[];
  eyeDropperSupported: boolean;
  onSaturationPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onSaturationPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onHueChange: (value: number) => void;
  onAlphaChange: (value: number) => void;
  onHexChange: (value: string) => void;
  onHexBlur: () => void;
  onSelectSavedColor: (value: string) => void;
  onAddSavedColor: () => void;
  onEyeDropper: () => void;
}

const DRAWING_STORAGE_VERSION = 1;
const DEFAULT_COLOR = '#ef4444';
const DEFAULT_SIZE = 6;
const MIN_SIZE = 2;
const MAX_SIZE = 32;
const DEFAULT_SAVED_COLORS = ['#12b76a', '#2e6de6', '#4b4ded', '#9638e8', '#c026d3', '#db2777', '#dc2626', '#ea580c', '#7c5ce0'];

function normalizeHex(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.split('').map((character) => `${character}${character}`).join('')}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(trimmed)) {
    return `#${trimmed}`.toLowerCase();
  }
  return null;
}

function hexToHsv(hex: string): HsvColor {
  const normalized = normalizeHex(hex) || DEFAULT_COLOR;
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta !== 0) {
    if (maximum === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (maximum === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  if (hue < 0) hue += 360;

  return {
    hue,
    saturation: maximum === 0 ? 0 : (delta / maximum) * 100,
    value: maximum * 100
  };
}

function hsvToHex({ hue, saturation, value }: HsvColor): string {
  const saturationRatio = saturation / 100;
  const valueRatio = value / 100;
  const chroma = valueRatio * saturationRatio;
  const hueSegment = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  const match = valueRatio - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSegment < 1) {
    red = chroma;
    green = secondary;
  } else if (hueSegment < 2) {
    red = secondary;
    green = chroma;
  } else if (hueSegment < 3) {
    green = chroma;
    blue = secondary;
  } else if (hueSegment < 4) {
    green = secondary;
    blue = chroma;
  } else if (hueSegment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const toHex = (channel: number) => Math.round((channel + match) * 255).toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function clampPoint(point: DrawingPoint): DrawingPoint {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y))
  };
}

function isDrawingPoint(value: unknown): value is DrawingPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<DrawingPoint>;
  return typeof point.x === 'number' && Number.isFinite(point.x)
    && typeof point.y === 'number' && Number.isFinite(point.y);
}

function isDrawingStroke(value: unknown): value is DrawingStroke {
  if (!value || typeof value !== 'object') return false;
  const stroke = value as Partial<DrawingStroke>;
  return Array.isArray(stroke.points)
    && stroke.points.length > 0
    && stroke.points.every(isDrawingPoint)
    && typeof stroke.color === 'string'
    && typeof stroke.size === 'number'
    && Number.isFinite(stroke.size)
    && (stroke.alpha === undefined || (typeof stroke.alpha === 'number' && Number.isFinite(stroke.alpha)))
    && (stroke.tool === 'pen' || stroke.tool === 'marker' || stroke.tool === 'eraser');
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  width: number,
  height: number
) {
  if (stroke.points.length === 0) return;

  const firstPoint = stroke.points[0];
  const firstX = firstPoint.x * width;
  const firstY = firstPoint.y * height;
  const strokeAlpha = Math.min(1, Math.max(0, stroke.alpha ?? 1));
  const opacity = stroke.tool === 'marker' ? strokeAlpha * 0.38 : strokeAlpha;

  context.save();
  context.globalAlpha = opacity;
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.tool === 'marker' ? stroke.size * 2.25 : stroke.size;
  context.lineCap = stroke.tool === 'marker' ? 'butt' : 'round';
  context.lineJoin = stroke.tool === 'marker' ? 'miter' : 'round';

  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(firstX, firstY, Math.max(context.lineWidth / 2, 1), 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(firstX, firstY);
    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x * width, point.y * height);
    }
    context.stroke();
  }

  context.restore();
}

function ColorPickerPopover({
  color,
  hue,
  saturation,
  value,
  alpha,
  hexInput,
  savedColors,
  eyeDropperSupported,
  onSaturationPointerDown,
  onSaturationPointerMove,
  onHueChange,
  onAlphaChange,
  onHexChange,
  onHexBlur,
  onSelectSavedColor,
  onAddSavedColor,
  onEyeDropper
}: ColorPickerPopoverProps) {
  return (
    <div
      className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="relative h-44 cursor-crosshair overflow-hidden rounded-lg border border-border/70"
        style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
        onPointerDown={onSaturationPointerDown}
        onPointerMove={onSaturationPointerMove}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(15,23,42,0.35)]"
          style={{ left: `${saturation}%`, top: `${100 - value}%` }}
        />
      </div>

      <div className="mt-4 space-y-3">
        <div className="relative h-3 rounded-full bg-[linear-gradient(to_right,#ef4444,#f97316,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899,#ef4444)]">
          <input
            aria-label="Hue"
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={(event) => onHueChange(Number(event.target.value))}
            className="absolute inset-0 h-3 w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-transparent shadow-[0_0_0_1px_rgba(15,23,42,0.35)]"
            style={{ left: `${(hue / 360) * 100}%` }}
          />
        </div>

        <div
          className="relative h-3 overflow-hidden rounded-full border border-border/50"
          style={{
            backgroundImage: `linear-gradient(to right, transparent, ${color}), conic-gradient(#d1d5db 25%, #ffffff 0 50%, #d1d5db 0 75%, #ffffff 0)`,
            backgroundSize: '100% 100%, 8px 8px'
          }}
        >
          <input
            aria-label="Opacity"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={alpha}
            onChange={(event) => onAlphaChange(Number(event.target.value))}
            className="absolute inset-0 h-3 w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-transparent shadow-[0_0_0_1px_rgba(15,23,42,0.35)]"
            style={{ left: `${alpha * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Pick color with eyedropper"
          disabled={!eyeDropperSupported}
          onClick={onEyeDropper}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title={eyeDropperSupported ? 'Pick color from screen' : 'Eyedropper is not supported in this browser'}
        >
          <Pipette className="h-4 w-4" />
        </button>
        <span className="inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground">
          Hex
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </span>
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3">
          <span className="h-4 w-4 shrink-0 rounded-full border border-border" style={{ backgroundColor: color }} />
          <span className="sr-only">Hex color</span>
          <input
            aria-label="Hex color"
            value={hexInput}
            onChange={(event) => onHexChange(event.target.value)}
            onBlur={onHexBlur}
            className="min-w-0 w-full bg-transparent text-sm font-semibold uppercase text-foreground outline-none"
            spellCheck={false}
          />
        </label>
        <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground">
          {Math.round(alpha * 100)}%
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Saved</span>
        <button
          type="button"
          onClick={onAddSavedColor}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {savedColors.map((savedColor) => (
          <button
            key={savedColor}
            type="button"
            aria-label={`Use saved color ${savedColor}`}
            onClick={() => onSelectSavedColor(savedColor)}
            className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${savedColor.toLowerCase() === color.toLowerCase() ? 'border-foreground ring-2 ring-primary/30' : 'border-transparent'}`}
            style={{ backgroundColor: savedColor }}
          />
        ))}
      </div>
    </div>
  );
}

export default function DrawableCanvas({ active, storageKey, containerRef, onExit }: DrawableCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<DrawingStroke[]>([]);
  const draftStrokeRef = useRef<DrawingStroke | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [hexInput, setHexInput] = useState(DEFAULT_COLOR.toUpperCase());
  const [hue, setHue] = useState(() => hexToHsv(DEFAULT_COLOR).hue);
  const [saturation, setSaturation] = useState(() => hexToHsv(DEFAULT_COLOR).saturation);
  const [value, setValue] = useState(() => hexToHsv(DEFAULT_COLOR).value);
  const [alpha, setAlpha] = useState(1);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [savedColors, setSavedColors] = useState(DEFAULT_SAVED_COLORS);
  const [eyeDropperSupported, setEyeDropperSupported] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    const pixelWidth = Math.max(1, Math.round(width * devicePixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * devicePixelRatio));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    for (const stroke of strokesRef.current) {
      drawStroke(context, stroke, width, height);
    }
    if (draftStrokeRef.current) {
      drawStroke(context, draftStrokeRef.current, width, height);
    }
  }, []);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [redraw, strokes]);

  useEffect(() => {
    hydratedRef.current = false;
    strokesRef.current = [];
    draftStrokeRef.current = null;
    setStrokes([]);

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const snapshot = JSON.parse(stored) as Partial<DrawingSnapshot>;
        if (snapshot.version === DRAWING_STORAGE_VERSION && Array.isArray(snapshot.strokes)) {
          const restoredStrokes = snapshot.strokes.filter(isDrawingStroke).map((stroke) => ({
            ...stroke,
            alpha: Math.min(1, Math.max(0, stroke.alpha ?? 1)),
            points: stroke.points.map(clampPoint),
            size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, stroke.size))
          }));
          strokesRef.current = restoredStrokes;
          setStrokes(restoredStrokes);
        }
      }
    } catch {
      // Ignore malformed or unavailable local storage and keep the canvas usable.
    }

    hydratedRef.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    try {
      if (strokes.length === 0) {
        window.localStorage.removeItem(storageKey);
      } else {
        const snapshot: DrawingSnapshot = {
          version: DRAWING_STORAGE_VERSION,
          strokes
        };
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      }
    } catch {
      // Ignore storage restrictions and keep the in-memory drawing usable.
    }
  }, [strokes, storageKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(parent);
    redraw();

    return () => resizeObserver.disconnect();
  }, [redraw]);

  useEffect(() => {
    if (!active) {
      pointerIdRef.current = null;
      draftStrokeRef.current = null;
      redraw();
    }
  }, [active, redraw]);

  useEffect(() => {
    setEyeDropperSupported(typeof window !== 'undefined' && 'EyeDropper' in window);
  }, []);

  useEffect(() => {
    if (!isColorPickerOpen) return;

    function handleDocumentPointerDown(event: MouseEvent) {
      if (!colorPickerRef.current?.contains(event.target as Node)) {
        setIsColorPickerOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown);
  }, [isColorPickerOpen]);

  // Handle text selection highlighting when marker is active
  useEffect(() => {
    if (!active || tool !== 'marker') return;

    function handleSelectionHighlight() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

      const targetContainer = containerRef?.current || canvasRef.current?.parentElement;
      const canvas = canvasRef.current;
      if (!targetContainer || !canvas) return;

      const range = selection.getRangeAt(0);
      const commonAncestor = range.commonAncestorContainer;
      if (!targetContainer.contains(commonAncestor)) return;

      const canvasRect = canvas.getBoundingClientRect();
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

      const clientRects = Array.from(range.getClientRects());
      if (clientRects.length === 0) return;

      const newStrokes: DrawingStroke[] = [];

      for (const rect of clientRects) {
        if (rect.width <= 1 || rect.height <= 1) continue;

        const centerY = rect.top + rect.height / 2;
        const normY = clampPoint({ x: 0, y: (centerY - canvasRect.top) / canvasRect.height }).y;
        const startNormX = clampPoint({ x: (rect.left - canvasRect.left) / canvasRect.width, y: 0 }).x;
        const endNormX = clampPoint({ x: (rect.right - canvasRect.left) / canvasRect.width, y: 0 }).x;

        // Size stroke to neatly cover the font line height (drawStroke applies * 2.25 to stroke.size for markers)
        const strokeSize = Math.max(MIN_SIZE, Math.round(rect.height / 2.25));

        newStrokes.push({
          points: [
            { x: startNormX, y: normY },
            { x: endNormX, y: normY }
          ],
          color,
          size: strokeSize,
          alpha,
          tool: 'marker'
        });
      }

      if (newStrokes.length > 0) {
        const nextStrokes = [...strokesRef.current, ...newStrokes];
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
        selection.removeAllRanges();
      }
    }

    document.addEventListener('pointerup', handleSelectionHighlight);
    document.addEventListener('mouseup', handleSelectionHighlight);
    return () => {
      document.removeEventListener('pointerup', handleSelectionHighlight);
      document.removeEventListener('mouseup', handleSelectionHighlight);
    };
  }, [active, tool, color, alpha, containerRef]);

  function updatePickerFromHsv(nextHsv: HsvColor) {
    const nextColor = hsvToHex(nextHsv);
    setHue(nextHsv.hue);
    setSaturation(nextHsv.saturation);
    setValue(nextHsv.value);
    setColor(nextColor);
    setHexInput(nextColor.toUpperCase());
  }

  function updatePickerFromHex(nextColor: string) {
    const nextHsv = hexToHsv(nextColor);
    setHue(nextHsv.hue);
    setSaturation(nextHsv.saturation);
    setValue(nextHsv.value);
    setColor(nextColor);
    setHexInput(nextColor.toUpperCase());
  }

  function updateSaturationFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    updatePickerFromHsv({
      hue,
      saturation: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      value: Math.min(100, Math.max(0, 100 - ((event.clientY - rect.top) / rect.height) * 100))
    });
  }

  function handleSaturationPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSaturationFromPointer(event);
  }

  function handleSaturationPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.buttons === 0) return;
    updateSaturationFromPointer(event);
  }

  function handleHexChange(nextValue: string) {
    const nextInput = nextValue.toUpperCase();
    setHexInput(nextInput);
    const nextColor = normalizeHex(nextInput);
    if (nextColor) updatePickerFromHex(nextColor);
  }

  function handleHexBlur() {
    const normalized = normalizeHex(hexInput);
    if (normalized) {
      updatePickerFromHex(normalized);
    } else {
      setHexInput(color.toUpperCase());
    }
  }

  async function handleEyeDropper() {
    const EyeDropperConstructor = (window as Window & {
      EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
    }).EyeDropper;
    if (!EyeDropperConstructor) return;

    try {
      const result = await new EyeDropperConstructor().open();
      const nextColor = normalizeHex(result.sRGBHex);
      if (nextColor) updatePickerFromHex(nextColor);
    } catch {
      // The browser closes the eyedropper when the user presses Escape; no action is needed.
    }
  }

  function addSavedColor() {
    setSavedColors((currentColors) => currentColors.includes(color) ? currentColors : [...currentColors, color]);
  }

  function getPoint(event: PointerEvent<HTMLCanvasElement>): DrawingPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return clampPoint({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!active || (event.pointerType === 'mouse' && event.button !== 0)) return;

    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    draftStrokeRef.current = {
      points: [getPoint(event)],
      color,
      size,
      alpha,
      tool
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore pointer capture failures; pointer events can still complete normally.
    }
    redraw();
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!active || pointerIdRef.current !== event.pointerId || !draftStrokeRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    draftStrokeRef.current.points.push(getPoint(event));

    const canvas = event.currentTarget;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const points = draftStrokeRef.current.points;
    const previousPoint = points[points.length - 2];
    const currentPoint = points[points.length - 1];
    if (!context || !previousPoint || !currentPoint || rect.width <= 0 || rect.height <= 0) return;

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    context.save();
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.globalAlpha = (draftStrokeRef.current.tool === 'marker' ? 0.38 : 1) * (draftStrokeRef.current.alpha ?? 1);
    context.globalCompositeOperation = draftStrokeRef.current.tool === 'eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = draftStrokeRef.current.color;
    context.lineWidth = draftStrokeRef.current.tool === 'marker' ? draftStrokeRef.current.size * 2.25 : draftStrokeRef.current.size;
    context.lineCap = draftStrokeRef.current.tool === 'marker' ? 'butt' : 'round';
    context.lineJoin = draftStrokeRef.current.tool === 'marker' ? 'miter' : 'round';
    context.beginPath();
    context.moveTo(previousPoint.x * rect.width, previousPoint.y * rect.height);
    context.lineTo(currentPoint.x * rect.width, currentPoint.y * rect.height);
    context.stroke();
    context.restore();
  }

  function finishPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore pointer capture failures.
    }

    const completedStroke = draftStrokeRef.current;
    pointerIdRef.current = null;
    draftStrokeRef.current = null;
    if (completedStroke) {
      const nextStrokes = [...strokesRef.current, completedStroke];
      strokesRef.current = nextStrokes;
      setStrokes(nextStrokes);
    }
    redraw();
  }

  function handlePointerCancel(event: PointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    draftStrokeRef.current = null;
    redraw();
  }

  function undoLastStroke() {
    const nextStrokes = strokesRef.current.slice(0, -1);
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);
  }

  function clearCanvas() {
    strokesRef.current = [];
    setStrokes([]);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <canvas
        ref={canvasRef}
        aria-label={active ? 'Drawable review canvas' : undefined}
        aria-hidden={!active}
        className={`absolute inset-0 h-full w-full ${!active ? 'pointer-events-none' : (tool === 'marker' ? 'pointer-events-none cursor-text' : 'pointer-events-auto cursor-crosshair')}`}
        style={{ touchAction: active ? 'none' : 'auto' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={handlePointerCancel}
      />

      {active && (
        <div
          className="pointer-events-auto absolute left-1/2 top-3 z-40 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border bg-card/95 p-1.5 text-foreground shadow-lg backdrop-blur-sm"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Use pen"
            aria-pressed={tool === 'pen'}
            onClick={() => setTool('pen')}
            className={`rounded-xl p-2 transition-colors ${tool === 'pen' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <PenTool className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Use marker / highlight"
            aria-pressed={tool === 'marker'}
            onClick={() => setTool('marker')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors ${tool === 'marker' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Highlighter className="h-4 w-4" />
            <span>Marker</span>
          </button>
          <button
            type="button"
            aria-label="Use eraser"
            aria-pressed={tool === 'eraser'}
            onClick={() => setTool('eraser')}
            className={`rounded-xl p-2 transition-colors ${tool === 'eraser' ? 'bg-slate-700 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Eraser className="h-4 w-4" />
          </button>
          <div ref={colorPickerRef} className="relative">
            <button
              type="button"
              aria-label="Choose drawing color"
              aria-expanded={isColorPickerOpen}
              onClick={() => setIsColorPickerOpen((open) => !open)}
              className={`inline-flex items-center gap-1.5 rounded-xl p-1.5 transition-colors ${isColorPickerOpen ? 'bg-muted' : 'hover:bg-muted'}`}
            >
              <span className="h-6 w-6 rounded-full border-2 border-white shadow-[0_0_0_1px_hsl(var(--border))]" style={{ backgroundColor: color }} />
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isColorPickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {isColorPickerOpen && (
              <ColorPickerPopover
                color={color}
                hue={hue}
                saturation={saturation}
                value={value}
                alpha={alpha}
                hexInput={hexInput}
                savedColors={savedColors}
                eyeDropperSupported={eyeDropperSupported}
                onSaturationPointerDown={handleSaturationPointerDown}
                onSaturationPointerMove={handleSaturationPointerMove}
                onHueChange={(nextHue) => updatePickerFromHsv({ hue: nextHue, saturation, value })}
                onAlphaChange={setAlpha}
                onHexChange={handleHexChange}
                onHexBlur={handleHexBlur}
                onSelectSavedColor={updatePickerFromHex}
                onAddSavedColor={addSavedColor}
                onEyeDropper={handleEyeDropper}
              />
            )}
          </div>
          <label className="flex items-center gap-1.5 px-1.5" title={`Brush size: ${size}px`}>
            <span className="sr-only">Brush size</span>
            <input
              type="range"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
              className="h-1.5 w-16 cursor-pointer accent-primary sm:w-20"
            />
            <output
              aria-label={`Brush size ${size} pixels`}
              className="min-w-10 rounded-lg border border-border bg-card px-1.5 py-1 text-center text-[11px] font-bold tabular-nums text-foreground"
            >
              {size}px
            </output>
          </label>
          <button
            type="button"
            aria-label="Undo last stroke"
            disabled={strokes.length === 0}
            onClick={undoLastStroke}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Clear drawings"
            disabled={strokes.length === 0}
            onClick={clearCanvas}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

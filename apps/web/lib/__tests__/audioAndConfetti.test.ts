import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuizAudioManager } from '../audio';
import { triggerCelebrationConfetti } from '../confetti';
import confetti from 'canvas-confetti';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

describe('QuizAudioManager', () => {
  let originalAudio: typeof Audio;
  let mockPlay: any;
  let mockAudioInstance: any;

  beforeEach(() => {
    mockLocalStorage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        innerWidth: 1024,
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      },
      writable: true,
      configurable: true,
    });

    mockPlay = vi.fn().mockResolvedValue(undefined);
    mockAudioInstance = {
      play: mockPlay,
      preload: '',
      volume: 1,
      currentTime: 0,
    };
    originalAudio = globalThis.Audio;
    globalThis.Audio = vi.fn().mockImplementation(() => mockAudioInstance) as any;
  });

  afterEach(() => {
    globalThis.Audio = originalAudio;
    vi.restoreAllMocks();
  });

  it('initializes unmuted by default', () => {
    const manager = new QuizAudioManager();
    expect(manager.isMuted()).toBe(false);
  });

  it('toggles mute state and saves to localStorage', () => {
    const manager = new QuizAudioManager();
    const nextState = manager.toggleMute();

    expect(nextState).toBe(true);
    expect(manager.isMuted()).toBe(true);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('quiz_sound_muted', 'true');

    const nextState2 = manager.toggleMute();
    expect(nextState2).toBe(false);
    expect(manager.isMuted()).toBe(false);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('quiz_sound_muted', 'false');
  });

  it('notifies subscribers on mute change', () => {
    const manager = new QuizAudioManager();
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);

    manager.setMuted(true);
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
    manager.setMuted(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('preloads correct and success sound files with volume set to 0.7', () => {
    const manager = new QuizAudioManager();
    manager.preload();

    expect(globalThis.Audio).toHaveBeenCalledWith('/correct_sound.mp3');
    expect(globalThis.Audio).toHaveBeenCalledWith('/success_sound.mp3');
    expect(mockAudioInstance.volume).toBe(0.7);
    expect(mockAudioInstance.preload).toBe('auto');
  });

  it('plays correct and success sounds when unmuted', async () => {
    const manager = new QuizAudioManager();
    manager.preload();

    await manager.playCorrectSound();
    expect(mockPlay).toHaveBeenCalledTimes(1);

    await manager.playSuccessSound();
    expect(mockPlay).toHaveBeenCalledTimes(2);
  });

  it('does not play sounds when muted', async () => {
    const manager = new QuizAudioManager();
    manager.preload();
    manager.setMuted(true);

    await manager.playCorrectSound();
    await manager.playSuccessSound();

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('gracefully handles browser autoplay policy rejection (NotAllowedError)', async () => {
    const notAllowedErr = new Error('Autoplay not allowed');
    notAllowedErr.name = 'NotAllowedError';
    mockPlay = vi.fn().mockRejectedValue(notAllowedErr);
    mockAudioInstance.play = mockPlay;

    const manager = new QuizAudioManager();
    manager.preload();

    // Should resolve cleanly without throwing
    await expect(manager.playSuccessSound()).resolves.toBeUndefined();
  });
});

describe('triggerCelebrationConfetti', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(globalThis, 'window', {
      value: {
        innerWidth: 1024,
        matchMedia: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
        })),
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 8,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires confetti with celebration colors and reduced motion safeguard', () => {
    triggerCelebrationConfetti();

    expect(confetti).toHaveBeenCalled();
    const firstCallArgs = vi.mocked(confetti).mock.calls[0][0];
    expect(firstCallArgs?.disableForReducedMotion).toBe(true);
    expect(firstCallArgs?.colors).toContain('#10b981');
  });

  it('respects prefers-reduced-motion media query and skips confetti', () => {
    (globalThis as any).window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
    }));

    triggerCelebrationConfetti();
    expect(confetti).not.toHaveBeenCalled();
  });

  it('uses lightweight particle count on mobile screens', () => {
    (globalThis as any).window.innerWidth = 375;

    triggerCelebrationConfetti();

    expect(confetti).toHaveBeenCalledTimes(1);
    const args = vi.mocked(confetti).mock.calls[0][0];
    expect(args?.particleCount).toBe(45);
    expect(args?.spread).toBe(60);
  });

  it('fires dual burst on desktop screens', () => {
    (globalThis as any).window.innerWidth = 1200;
    (globalThis as any).navigator.hardwareConcurrency = 8;

    triggerCelebrationConfetti();
    expect(confetti).toHaveBeenCalledTimes(1);

    // Fast-forward delay for second cannon burst
    vi.advanceTimersByTime(200);
    expect(confetti).toHaveBeenCalledTimes(2);
  });
});

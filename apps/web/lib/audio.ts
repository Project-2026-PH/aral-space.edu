/**
 * Audio manager for quiz sound effects.
 * Handles sound preloading, volume normalization, user mute preferences (persisted to localStorage),
 * and graceful fallback for browser autoplay restrictions.
 */

const STORAGE_KEY = 'quiz_sound_muted';
const DEFAULT_VOLUME = 0.7;

export class QuizAudioManager {
  private correctAudio: HTMLAudioElement | null = null;
  private successAudio: HTMLAudioElement | null = null;
  private muted: boolean = false;
  private initialized: boolean = false;
  private listeners: Set<(muted: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init(): void {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.muted = stored === 'true';
    } catch {
      this.muted = false;
    }

    this.preload();
  }

  /**
   * Preload audio files so playback has zero latency upon answering or finishing.
   */
  public preload(): void {
    if (typeof window === 'undefined') return;

    try {
      if (!this.correctAudio && typeof Audio !== 'undefined') {
        this.correctAudio = new Audio('/correct_sound.mp3');
        this.correctAudio.preload = 'auto';
        this.correctAudio.volume = DEFAULT_VOLUME;
      }
      if (!this.successAudio && typeof Audio !== 'undefined') {
        this.successAudio = new Audio('/success_sound.mp3');
        this.successAudio.preload = 'auto';
        this.successAudio.volume = DEFAULT_VOLUME;
      }
    } catch (err) {
      console.warn('[QuizAudio] Preload failed:', err);
    }
  }

  /**
   * Checks whether sound is currently muted by user preference.
   */
  public isMuted(): boolean {
    if (typeof window !== 'undefined' && !this.initialized) {
      this.init();
    }
    return this.muted;
  }

  /**
   * Updates user mute preference and notifies listeners.
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, String(muted));
      } catch {
        // Ignore localStorage quota or privacy restrictions
      }
    }
    this.listeners.forEach((fn) => {
      try {
        fn(muted);
      } catch (err) {
        console.warn('[QuizAudio] Listener error:', err);
      }
    });
  }

  /**
   * Toggles mute state and returns the new state.
   */
  public toggleMute(): boolean {
    const next = !this.isMuted();
    this.setMuted(next);
    return next;
  }

  /**
   * Subscribe to mute changes.
   */
  public subscribe(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Play an audio element safely handling browser autoplay restrictions.
   */
  private async playAudio(audio: HTMLAudioElement | null, fallbackSrc: string): Promise<void> {
    if (this.isMuted() || typeof window === 'undefined') return;

    let target = audio;
    if (!target && typeof Audio !== 'undefined') {
      try {
        target = new Audio(fallbackSrc);
        target.volume = DEFAULT_VOLUME;
      } catch {
        return;
      }
    }

    if (!target) return;

    try {
      target.currentTime = 0;
      const playPromise = target.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (err: any) {
      // Gracefully ignore browser autoplay policy restrictions (NotAllowedError)
      if (err?.name === 'NotAllowedError') {
        console.warn('[QuizAudio] Autoplay restricted by browser policy');
      } else {
        console.warn('[QuizAudio] Playback error:', err);
      }
    }
  }

  /**
   * Plays the short correct answer chime.
   */
  public async playCorrectSound(): Promise<void> {
    await this.playAudio(this.correctAudio, '/correct_sound.mp3');
  }

  /**
   * Plays the session completion success sound.
   */
  public async playSuccessSound(): Promise<void> {
    await this.playAudio(this.successAudio, '/success_sound.mp3');
  }
}

export const quizAudio = new QuizAudioManager();

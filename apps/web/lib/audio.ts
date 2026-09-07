/**
 * Audio manager for quiz sound effects.
 * Uses Web Audio API (AudioContext) to avoid interrupting background music on iOS.
 * HTML5 <audio> elements claim exclusive audio sessions on iOS, forcing system background audio to pause.
 * AudioContext created on user interaction does not interrupt background music on iOS 15+.
 * Falls back to HTML5 <audio> if AudioContext is unavailable.
 * Handles sound preloading, volume normalization, user mute preferences (persisted to localStorage),
 * and graceful fallback for browser autoplay restrictions.
 */

const STORAGE_KEY = 'quiz_sound_muted';
const DEFAULT_VOLUME = 0.7;

export class QuizAudioManager {
  private correctAudio: HTMLAudioElement | null = null;
  private successAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private correctAudioBuffer: AudioBuffer | null = null;
  private successAudioBuffer: AudioBuffer | null = null;
  private muted: boolean = false;
  private initialized: boolean = false;
  private listeners: Set<(muted: boolean) => void> = new Set();
  private audioContextInitialized: boolean = false;

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
   * Initialize AudioContext on first user interaction to bypass iOS restrictions.
   */
  private ensureAudioContext(): void {
    if (this.audioContextInitialized || typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        this.audioContextInitialized = true;
      }
    } catch (err) {
      console.warn('[QuizAudio] AudioContext initialization failed:', err);
      this.audioContextInitialized = true; // Mark as attempted to avoid retries
    }
  }

  /**
   * Load audio file as AudioBuffer for Web Audio API playback.
   */
  private async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.warn(`[QuizAudio] Failed to load audio buffer from ${url}:`, err);
      return null;
    }
  }

  /**
   * Preload audio files so playback has zero latency upon answering or finishing.
   * Attempts Web Audio API first, falls back to HTML5 <audio> elements.
   */
  public preload(): void {
    if (typeof window === 'undefined') return;

    try {
      // Initialize AudioContext for Web Audio API (deferred to first user interaction)
      this.ensureAudioContext();

      // Fallback: preload HTML5 audio elements
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
   * Play audio using Web Audio API if available, with fallback to HTML5 <audio>.
   * Web Audio API avoids interrupting background music on iOS.
   */
  private async playAudio(
    audioBuffer: AudioBuffer | null,
    audioElement: HTMLAudioElement | null,
    fallbackSrc: string
  ): Promise<void> {
    if (this.isMuted() || typeof window === 'undefined') return;

    // Ensure AudioContext is initialized on first playback
    this.ensureAudioContext();

    // Try Web Audio API first (preferred for iOS compatibility)
    if (this.audioContext && audioBuffer) {
      try {
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = audioBuffer;
        gainNode.gain.value = DEFAULT_VOLUME;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(0);
        return;
      } catch (err) {
        console.warn('[QuizAudio] Web Audio API playback failed:', err);
        // Fall through to HTML5 audio fallback
      }
    }

    // Fallback to HTML5 <audio>
    let target = audioElement;
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
    // Load audio buffer on first play if not already loaded
    if (!this.correctAudioBuffer && this.audioContext) {
      this.correctAudioBuffer = await this.loadAudioBuffer('/correct_sound.mp3');
    }
    await this.playAudio(this.correctAudioBuffer, this.correctAudio, '/correct_sound.mp3');
  }

  /**
   * Plays the session completion success sound.
   */
  public async playSuccessSound(): Promise<void> {
    // Load audio buffer on first play if not already loaded
    if (!this.successAudioBuffer && this.audioContext) {
      this.successAudioBuffer = await this.loadAudioBuffer('/success_sound.mp3');
    }
    await this.playAudio(this.successAudioBuffer, this.successAudio, '/success_sound.mp3');
  }
}

export const quizAudio = new QuizAudioManager();

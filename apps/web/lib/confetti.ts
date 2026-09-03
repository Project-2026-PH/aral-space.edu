import confetti from 'canvas-confetti';

/**
 * Triggers a celebratory confetti particle animation on session completion.
 * Designed to be lightweight and performant across mobile and desktop devices,
 * with reduced-motion support and low particle counts for low-end devices.
 */
export function triggerCelebrationConfetti(): void {
  if (typeof window === 'undefined') return;

  // Respect system reduced-motion preference
  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return;
  }

  // Detect low-end / small-screen devices for performance optimization
  const isMobileOrLowEnd =
    window.innerWidth < 640 ||
    (typeof navigator !== 'undefined' &&
      navigator.hardwareConcurrency !== undefined &&
      navigator.hardwareConcurrency <= 4);

  const colors = ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#ec4899'];

  try {
    if (isMobileOrLowEnd) {
      // Single smooth, lightweight burst for mobile/low-end
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.65 },
        colors,
        disableForReducedMotion: true,
        ticks: 180,
        gravity: 1.1,
        scalar: 0.9,
      });
    } else {
      // Coordinated dual burst for desktop
      confetti({
        particleCount: 45,
        angle: 60,
        spread: 55,
        origin: { x: 0.15, y: 0.65 },
        colors,
        disableForReducedMotion: true,
        ticks: 200,
        gravity: 1.0,
      });

      setTimeout(() => {
        try {
          confetti({
            particleCount: 45,
            angle: 120,
            spread: 55,
            origin: { x: 0.85, y: 0.65 },
            colors,
            disableForReducedMotion: true,
            ticks: 200,
            gravity: 1.0,
          });
        } catch {
          // Ignore timeout execution failure if page was navigated away
        }
      }, 150);
    }
  } catch (err) {
    console.warn('[Confetti] Failed to execute celebration animation:', err);
  }
}

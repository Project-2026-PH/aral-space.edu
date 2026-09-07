/**
 * Provides optional tactile feedback for answer results in supported browsers.
 * Unsupported browsers, desktop environments, and blocked vibration calls are ignored.
 */
export function triggerIncorrectAnswerVibration(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  try {
    navigator.vibrate([80, 40, 160]);
  } catch {
    // Vibration is an optional enhancement and may be blocked by the browser.
  }
}

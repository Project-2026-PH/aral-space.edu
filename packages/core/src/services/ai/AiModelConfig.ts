/**
 * Centralized AI Model Configuration & Resilient Fallback Wrapper
 *
 * Groq model resolution uses runtime discovery via GET /openai/v1/models so
 * that the fallback chain always reflects what the API key actually has access
 * to, rather than a hardcoded list that drifts as models are deprecated.
 *
 * Failure handling is driven by classifyFailure(), which distinguishes a model
 * that no longer exists from a provider that is merely busy. The two demand
 * opposite responses: a decommissioned model must be swapped, while a rate
 * limit or capacity blip should be waited out on the same model before giving
 * up on it. Collapsing them causes needless model hopping.
 */

/**
 * Why a provider call failed. Each type maps to a distinct recovery strategy;
 * see RETRYABLE_ATTEMPTS and the execute*WithFallback methods.
 */
export enum AiFailureType {
  /** Model is gone, decommissioned or unknown to the provider. Switch model. */
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  /** Quota or requests-per-minute exceeded. Back off, then switch. */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Provider-side outage or overload. Brief backoff, then switch. */
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  /** Malformed request or context overflow. Retrying cannot help. */
  INVALID_REQUEST = 'INVALID_REQUEST',
  /** Missing, invalid or unauthorized credentials. Retrying cannot help. */
  AUTHENTICATION = 'AUTHENTICATION',
  /** Unrecognized failure. One cautious retry, then switch. */
  UNKNOWN = 'UNKNOWN'
}

export class AiModelConfig {
  /**
   * Ordered preference list for Groq model selection.
   * resolveGroqFallbacks() intersects this with models the key has access to.
   *
   * Production-tier models are ranked ahead of preview-tier ones. Groq
   * documents preview models as evaluation-only and subject to removal at
   * short notice, so qwen3.6-27b sits last as a resilience hop rather than a
   * default. Runtime discovery remains the authority on availability; this
   * list only expresses preference and acts as the offline fallback.
   */
  static readonly GROQ_PREFERRED_MODELS: string[] = [
    'openai/gpt-oss-120b', // production
    'openai/gpt-oss-20b',  // production
    'qwen/qwen3.6-27b',    // preview - last resort
  ];

  static readonly DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
  static readonly GEMINI_FALLBACK_MODELS: string[] = [
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ];

  /** First backoff delay, doubled per attempt. */
  static readonly BASE_BACKOFF_MS = 500;
  /** Ceiling for any single wait, including provider-supplied Retry-After. */
  static readonly MAX_BACKOFF_MS = 8000;

  /**
   * Same-model retry budget per failure type. Anything absent is not retried on
   * the same model. These are hard ceilings: there is no unbounded retry path.
   */
  static readonly RETRYABLE_ATTEMPTS: Partial<Record<AiFailureType, number>> = {
    [AiFailureType.RATE_LIMITED]: 3,
    [AiFailureType.PROVIDER_UNAVAILABLE]: 3,
    [AiFailureType.UNKNOWN]: 1
  };

  /** Failure types where switching to another model is pointless. */
  static readonly NON_RECOVERABLE: AiFailureType[] = [
    AiFailureType.AUTHENTICATION,
    AiFailureType.INVALID_REQUEST
  ];

  static getGeminiModel(override?: string): string {
    return override || process.env.GEMINI_MODEL || this.DEFAULT_GEMINI_MODEL;
  }

  /**
   * Queries GET /openai/v1/models with the given API key and returns available
   * Groq model IDs ordered by GROQ_PREFERRED_MODELS. Falls back to the full
   * preference list unchanged if discovery fails (e.g., no network).
   */
  static async resolveGroqFallbacks(apiKey: string, exclude?: string): Promise<string[]> {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) throw new Error(`/models returned ${res.status}`);
      const json = await res.json() as { data?: Array<{ id: string }> };
      const available = new Set((json.data ?? []).map((m) => m.id));
      const ranked = this.GROQ_PREFERRED_MODELS.filter((m) => available.has(m) && m !== exclude);
      console.log(`[AiModelConfig] Groq model discovery: ${available.size} available, ${ranked.length} preferred candidates.`);
      return ranked.length > 0 ? ranked : this.GROQ_PREFERRED_MODELS.filter((m) => m !== exclude);
    } catch (e: any) {
      console.warn(`[AiModelConfig] Groq model discovery failed (${e.message}), using static preference list.`);
      return this.GROQ_PREFERRED_MODELS.filter((m) => m !== exclude);
    }
  }

  /**
   * Returns the best Groq model to use as the primary request model.
   * Uses env override > explicit override > first model from discovery.
   */
  static getGroqModel(override?: string): string {
    return override || process.env.GROQ_MODEL || this.GROQ_PREFERRED_MODELS[0];
  }

  /** Pulls an HTTP status off the various shapes the provider SDKs throw. */
  private static extractStatus(err: any): number | undefined {
    const candidates = [err?.status, err?.statusCode, err?.code, err?.response?.status, err?.error?.status];
    for (const c of candidates) {
      if (typeof c === 'number' && c >= 100 && c < 600) return c;
    }
    return undefined;
  }

  /** Lowercased haystack combining message, nested error message and codes. */
  private static errorText(err: any): string {
    const parts = [
      typeof err?.message === 'string' ? err.message : '',
      typeof err?.error?.message === 'string' ? err.error.message : '',
      typeof err?.error?.code === 'string' ? err.error.code : '',
      typeof err?.code === 'string' ? err.code : '',
      typeof err?.status === 'string' ? err.status : ''
    ];
    return parts.join(' ').toLowerCase();
  }

  /**
   * Maps a thrown provider error onto an AiFailureType.
   *
   * Order matters. Credentials and rate limits are checked before model
   * existence because a 404-shaped message can accompany an auth problem, and
   * because "quota exceeded" must never be read as "this model is gone".
   */
  static classifyFailure(err: any): AiFailureType {
    const status = this.extractStatus(err);
    const text = this.errorText(err);
    const has = (...needles: string[]) => needles.some((n) => text.includes(n));

    // 1. Credentials. Never retry; the same key will keep failing.
    if (
      status === 401 ||
      status === 403 ||
      has('api key', 'api_key', 'unauthorized', 'unauthenticated', 'permission denied', 'permission_denied', 'invalid authentication')
    ) {
      return AiFailureType.AUTHENTICATION;
    }

    // 2. Rate limiting / quota. Retryable after a wait.
    if (status === 429 || has('rate limit', 'rate_limit', 'too many requests', 'quota', 'resource_exhausted')) {
      return AiFailureType.RATE_LIMITED;
    }

    // 3. Model genuinely gone. Only now is swapping the model the right move.
    if (
      status === 404 ||
      has(
        'model_not_found',
        'model_decommissioned',
        'does not exist',
        'not found',
        'not_found',
        'decommissioned',
        'no longer supported',
        'no longer available',
        'is not supported'
      )
    ) {
      return AiFailureType.MODEL_UNAVAILABLE;
    }

    // 4. Provider-side capacity or outage. Retryable after a wait.
    if (
      (typeof status === 'number' && status >= 500 && status <= 504) ||
      has(
        'service unavailable',
        'unavailable',
        'high demand',
        'try again later',
        'overloaded',
        'internal error',
        'econnreset',
        'etimedout',
        'fetch failed',
        'socket hang up'
      )
    ) {
      return AiFailureType.PROVIDER_UNAVAILABLE;
    }

    // 5. Our request is wrong. Retrying an identical request cannot fix it.
    if (status === 400 || status === 413 || status === 422 || has('invalid request', 'bad request', 'context length', 'too large', 'invalid_request')) {
      return AiFailureType.INVALID_REQUEST;
    }

    return AiFailureType.UNKNOWN;
  }

  /**
   * True only when the model itself is unavailable.
   *
   * Behavior change: this previously also returned true for 429 and 503 (Gemini)
   * and for 400 (Groq), which made rate limits and bad requests trigger model
   * hopping. Those now classify as RATE_LIMITED, PROVIDER_UNAVAILABLE and
   * INVALID_REQUEST respectively. Retained as a thin wrapper for callers that
   * only need the model-existence question answered.
   */
  static isGroqModelError(err: any): boolean {
    return this.classifyFailure(err) === AiFailureType.MODEL_UNAVAILABLE;
  }

  /** See isGroqModelError. Same semantics; kept separate for call-site clarity. */
  static isGeminiModelError(err: any): boolean {
    return this.classifyFailure(err) === AiFailureType.MODEL_UNAVAILABLE;
  }

  /**
   * Reads a provider-supplied retry hint. Supports the Retry-After header
   * (seconds or HTTP date) and Gemini's RetryInfo errorDetails entry.
   * Result is clamped to MAX_BACKOFF_MS so a hostile or absurd hint cannot
   * stall the pipeline.
   */
  static extractRetryAfterMs(err: any): number | undefined {
    const readHeader = (): string | undefined => {
      const h = err?.headers ?? err?.response?.headers;
      if (!h) return undefined;
      if (typeof h.get === 'function') return h.get('retry-after') ?? undefined;
      return h['retry-after'] ?? h['Retry-After'] ?? undefined;
    };

    let ms: number | undefined;

    const raw = readHeader();
    if (raw !== undefined) {
      const seconds = Number(raw);
      if (Number.isFinite(seconds)) {
        ms = seconds * 1000;
      } else {
        const when = Date.parse(String(raw));
        if (!Number.isNaN(when)) ms = when - Date.now();
      }
    }

    // Gemini surfaces retryDelay as e.g. "5s" inside errorDetails.
    if (ms === undefined) {
      const details = err?.errorDetails ?? err?.error?.details;
      if (Array.isArray(details)) {
        const info = details.find((d: any) => typeof d?.['@type'] === 'string' && d['@type'].includes('RetryInfo'));
        const delay = info?.retryDelay;
        if (typeof delay === 'string') {
          const seconds = Number(delay.replace(/s$/, ''));
          if (Number.isFinite(seconds)) ms = seconds * 1000;
        }
      }
    }

    if (ms === undefined || !Number.isFinite(ms) || ms < 0) return undefined;
    return Math.min(ms, this.MAX_BACKOFF_MS);
  }

  /**
   * Bounded exponential backoff. `attempt` is zero-based. A provider hint wins
   * when present; otherwise BASE_BACKOFF_MS doubles per attempt, capped at
   * MAX_BACKOFF_MS.
   */
  static computeBackoffMs(attempt: number, retryAfterMs?: number): number {
    if (typeof retryAfterMs === 'number' && retryAfterMs >= 0) {
      return Math.min(retryAfterMs, this.MAX_BACKOFF_MS);
    }
    return Math.min(this.BASE_BACKOFF_MS * Math.pow(2, attempt), this.MAX_BACKOFF_MS);
  }

  /** Indirection point so tests can neutralize real waiting. */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Runs `operation` against a single model, absorbing transient failures with
   * bounded backoff. Never throws: returns the outcome plus the final
   * classification so the caller can decide whether to switch models.
   */
  private static async attemptModel<T>(
    provider: string,
    model: string,
    operation: (model: string) => Promise<T>
  ): Promise<{ ok: true; value: T } | { ok: false; error: any; type: AiFailureType }> {
    let attempt = 0;

    for (;;) {
      const t0 = Date.now();
      try {
        const value = await operation(model);
        return { ok: true, value };
      } catch (err: any) {
        const type = this.classifyFailure(err);
        const maxRetries = this.RETRYABLE_ATTEMPTS[type] ?? 0;
        console.warn(
          `[AiModelConfig] ${provider} "${model}" failed after ${Date.now() - t0}ms [${type}]: ${err?.message}`
        );

        if (attempt >= maxRetries) {
          return { ok: false, error: err, type };
        }

        const waitMs = this.computeBackoffMs(attempt, this.extractRetryAfterMs(err));
        attempt++;
        console.warn(
          `[AiModelConfig] ${provider} "${model}" ${type}; backing off ${waitMs}ms (retry ${attempt}/${maxRetries})...`
        );
        await this.sleep(waitMs);
      }
    }
  }

  /**
   * Executes operation with requestedModel, then walks discovered fallbacks on
   * any model-not-found / decommissioned error. Passes apiKey for discovery.
   */
  static async executeGroqWithFallback<T>(
    requestedModel: string,
    operation: (model: string) => Promise<T>,
    apiKey?: string
  ): Promise<{ result: T; activeModel: string }> {
    const t0 = Date.now();
    console.log(`[AiModelConfig] Groq execution started with model "${requestedModel}"...`);

    const primary = await this.attemptModel('Groq', requestedModel, operation);
    if (primary.ok) {
      console.log(`[AiModelConfig] Groq execution succeeded with "${requestedModel}" in ${Date.now() - t0}ms`);
      return { result: primary.value, activeModel: requestedModel };
    }

    // Bad credentials or a malformed request will fail identically on every
    // model, so switching would only multiply the same error.
    if (this.NON_RECOVERABLE.includes(primary.type)) {
      console.error(`[AiModelConfig] Groq failed non-recoverably [${primary.type}]; not attempting other models.`);
      throw primary.error;
    }

    // Discover what the key can actually access, excluding the failed model.
    const fallbacks = apiKey
      ? await this.resolveGroqFallbacks(apiKey, requestedModel)
      : this.GROQ_PREFERRED_MODELS.filter((m) => m !== requestedModel);

    for (const fb of fallbacks) {
      console.warn(`[AiModelConfig] Retrying Groq with fallback model "${fb}" after [${primary.type}]...`);
      const fallbackT0 = Date.now();
      const attempt = await this.attemptModel('Groq', fb, operation);
      if (attempt.ok) {
        console.log(`[AiModelConfig] Groq fallback "${fb}" succeeded in ${Date.now() - fallbackT0}ms`);
        return { result: attempt.value, activeModel: fb };
      }
      if (this.NON_RECOVERABLE.includes(attempt.type)) {
        console.error(`[AiModelConfig] Groq fallback "${fb}" failed non-recoverably [${attempt.type}]; aborting.`);
        throw attempt.error;
      }
      console.warn(`[AiModelConfig] Groq fallback "${fb}" unusable [${attempt.type}]: ${attempt.error?.message}`);
    }

    console.error(`[AiModelConfig] Groq exhausted all ${fallbacks.length + 1} model candidates after ${Date.now() - t0}ms.`);
    throw primary.error;
  }

  static async executeGeminiWithFallback<T>(
    requestedModel: string,
    operation: (model: string) => Promise<T>
  ): Promise<{ result: T; activeModel: string }> {
    const t0 = Date.now();
    console.log(`[AiModelConfig] Gemini execution started with model "${requestedModel}"...`);

    const primary = await this.attemptModel('Gemini', requestedModel, operation);
    if (primary.ok) {
      console.log(`[AiModelConfig] Gemini execution succeeded with "${requestedModel}" in ${Date.now() - t0}ms`);
      return { result: primary.value, activeModel: requestedModel };
    }

    if (this.NON_RECOVERABLE.includes(primary.type)) {
      console.error(`[AiModelConfig] Gemini failed non-recoverably [${primary.type}]; not attempting other models.`);
      throw primary.error;
    }

    // A 503/429 has already been waited out on the requested model by
    // attemptModel. Reaching here means the whole provider is still refusing,
    // so the caller should be allowed to move on to another provider rather
    // than have us grind through every Gemini variant.
    const fallbacks = this.GEMINI_FALLBACK_MODELS.filter((m) => m !== requestedModel);

    for (const fb of fallbacks) {
      console.warn(`[AiModelConfig] Retrying Gemini with fallback model "${fb}" after [${primary.type}]...`);
      const fallbackT0 = Date.now();
      const attempt = await this.attemptModel('Gemini', fb, operation);
      if (attempt.ok) {
        console.log(`[AiModelConfig] Gemini fallback "${fb}" succeeded in ${Date.now() - fallbackT0}ms`);
        return { result: attempt.value, activeModel: fb };
      }
      if (this.NON_RECOVERABLE.includes(attempt.type)) {
        console.error(`[AiModelConfig] Gemini fallback "${fb}" failed non-recoverably [${attempt.type}]; aborting.`);
        throw attempt.error;
      }
      console.warn(`[AiModelConfig] Gemini fallback "${fb}" unusable [${attempt.type}]: ${attempt.error?.message}`);
    }

    console.error(`[AiModelConfig] Gemini exhausted all ${fallbacks.length + 1} model candidates after ${Date.now() - t0}ms.`);
    throw primary.error;
  }
}

/**
 * Centralized AI Model Configuration & Resilient Fallback Wrapper
 *
 * Groq model resolution uses runtime discovery via GET /openai/v1/models so
 * that the fallback chain always reflects what the API key actually has access
 * to, rather than a hardcoded list that drifts as models are deprecated.
 */
export class AiModelConfig {
  /**
   * Ordered preference list for Groq model selection.
   * resolveGroqFallbacks() intersects this with models the key has access to.
   */
  static readonly GROQ_PREFERRED_MODELS: string[] = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ];

  static readonly DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
  static readonly GEMINI_FALLBACK_MODELS: string[] = [
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
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

  static isGroqModelError(err: any): boolean {
    return (
      err?.status === 404 ||
      err?.status === 400 ||
      err?.error?.code === 'model_not_found' ||
      err?.error?.code === 'model_decommissioned' ||
      (typeof err?.message === 'string' &&
        (err.message.includes('model_not_found') ||
          err.message.includes('model_decommissioned') ||
          err.message.includes('does not exist') ||
          err.message.includes('not found') ||
          err.message.includes('decommissioned') ||
          err.message.includes('no longer supported')))
    );
  }

  static isGeminiModelError(err: any): boolean {
    return (
      err?.status === 404 ||
      err?.status === 503 ||
      err?.status === 429 ||
      err?.code === 503 ||
      err?.code === 404 ||
      (typeof err?.message === 'string' &&
        (err.message.includes('not found') ||
          err.message.includes('NOT_FOUND') ||
          err.message.includes('no longer available') ||
          err.message.includes('is not supported') ||
          err.message.includes('high demand') ||
          err.message.includes('UNAVAILABLE') ||
          err.message.includes('Service Unavailable') ||
          err.message.includes('try again later') ||
          err.message.includes('RESOURCE_EXHAUSTED')))
    );
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
    try {
      const res = await operation(requestedModel);
      console.log(`[AiModelConfig] Groq execution succeeded with "${requestedModel}" in ${Date.now() - t0}ms`);
      return { result: res, activeModel: requestedModel };
    } catch (err: any) {
      console.warn(`[AiModelConfig] Groq model "${requestedModel}" failed after ${Date.now() - t0}ms: ${err.message}`);
      if (this.isGroqModelError(err)) {
        // Discover what the key can actually access, exclude the already-failed model
        const fallbacks = apiKey
          ? await this.resolveGroqFallbacks(apiKey, requestedModel)
          : this.GROQ_PREFERRED_MODELS.filter((m) => m !== requestedModel);

        for (const fb of fallbacks) {
          try {
            console.warn(`[AiModelConfig] Retrying Groq with fallback model "${fb}"...`);
            const fallbackT0 = Date.now();
            const fallbackRes = await operation(fb);
            console.log(`[AiModelConfig] Groq fallback "${fb}" succeeded in ${Date.now() - fallbackT0}ms`);
            return { result: fallbackRes, activeModel: fb };
          } catch (fbErr: any) {
            if (!this.isGroqModelError(fbErr)) throw fbErr;
            console.warn(`[AiModelConfig] Groq fallback "${fb}" also not available: ${fbErr.message}`);
          }
        }
      }
      throw err;
    }
  }

  static async executeGeminiWithFallback<T>(
    requestedModel: string,
    operation: (model: string) => Promise<T>
  ): Promise<{ result: T; activeModel: string }> {
    const t0 = Date.now();
    console.log(`[AiModelConfig] Gemini execution started with model "${requestedModel}"...`);
    try {
      const res = await operation(requestedModel);
      console.log(`[AiModelConfig] Gemini execution succeeded with "${requestedModel}" in ${Date.now() - t0}ms`);
      return { result: res, activeModel: requestedModel };
    } catch (err: any) {
      console.warn(`[AiModelConfig] Gemini model "${requestedModel}" failed after ${Date.now() - t0}ms: ${err.message}`);
      if (this.isGeminiModelError(err)) {
        const fallbacks = this.GEMINI_FALLBACK_MODELS.filter((m) => m !== requestedModel);
        for (const fb of fallbacks) {
          try {
            console.warn(`[AiModelConfig] Retrying Gemini with fallback model "${fb}"...`);
            const fallbackT0 = Date.now();
            const fallbackRes = await operation(fb);
            console.log(`[AiModelConfig] Gemini fallback "${fb}" succeeded in ${Date.now() - fallbackT0}ms`);
            return { result: fallbackRes, activeModel: fb };
          } catch (fallbackErr: any) {
            if (!this.isGeminiModelError(fallbackErr)) throw fallbackErr;
            console.warn(`[AiModelConfig] Gemini fallback "${fb}" also failed: ${fallbackErr.message}`);
          }
        }
      }
      throw err;
    }
  }
}

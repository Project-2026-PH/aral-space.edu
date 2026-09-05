import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiModelConfig, AiFailureType } from '../AiModelConfig';

describe('AiModelConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Neutralize real waiting so backoff paths run instantly.
    vi.spyOn(AiModelConfig, 'sleep').mockResolvedValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Model Resolution', () => {
    it('returns first preferred Groq model when override and env are unset', () => {
      delete process.env.GROQ_MODEL;
      expect(AiModelConfig.getGroqModel()).toBe(AiModelConfig.GROQ_PREFERRED_MODELS[0]);
    });

    it('returns env GROQ_MODEL when override is unset', () => {
      process.env.GROQ_MODEL = 'qwen/qwen3.6-27b';
      expect(AiModelConfig.getGroqModel()).toBe('qwen/qwen3.6-27b');
    });

    it('prefers explicit override over env GROQ_MODEL', () => {
      process.env.GROQ_MODEL = 'qwen/qwen3.6-27b';
      expect(AiModelConfig.getGroqModel('custom-model')).toBe('custom-model');
    });

    it('returns default Gemini model when override and env are unset', () => {
      delete process.env.GEMINI_MODEL;
      expect(AiModelConfig.getGeminiModel()).toBe('gemini-3.8-flash');
    });

    it('returns env GEMINI_MODEL when override is unset', () => {
      process.env.GEMINI_MODEL = 'gemini-3.6-flash';
      expect(AiModelConfig.getGeminiModel()).toBe('gemini-3.6-flash');
    });

    it('prefers explicit override over env GEMINI_MODEL', () => {
      process.env.GEMINI_MODEL = 'gemini-3.6-flash';
      expect(AiModelConfig.getGeminiModel('gemini-1.5-pro')).toBe('gemini-1.5-pro');
    });
  });

  describe('Deprecated model removal', () => {
    // Every one of these is past its Groq shutdown date. Guards against a
    // dead model id being reintroduced into the preference chain.
    const DECOMMISSIONED = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct'
    ];

    it.each(DECOMMISSIONED)('does not offer decommissioned model %s', (model) => {
      expect(AiModelConfig.GROQ_PREFERRED_MODELS).not.toContain(model);
    });

    it('prefers currently supported Groq models', () => {
      expect(AiModelConfig.GROQ_PREFERRED_MODELS).toContain('openai/gpt-oss-120b');
      expect(AiModelConfig.GROQ_PREFERRED_MODELS).toContain('openai/gpt-oss-20b');
    });

    it('ranks production models ahead of preview models', () => {
      const list = AiModelConfig.GROQ_PREFERRED_MODELS;
      expect(list.indexOf('openai/gpt-oss-120b')).toBeLessThan(list.indexOf('qwen/qwen3.6-27b'));
      expect(list.indexOf('openai/gpt-oss-20b')).toBeLessThan(list.indexOf('qwen/qwen3.6-27b'));
    });
  });

  describe('classifyFailure', () => {
    it('classifies authentication failures', () => {
      expect(AiModelConfig.classifyFailure({ status: 401 })).toBe(AiFailureType.AUTHENTICATION);
      expect(AiModelConfig.classifyFailure({ status: 403 })).toBe(AiFailureType.AUTHENTICATION);
      expect(AiModelConfig.classifyFailure(new Error('Invalid API key (401)'))).toBe(AiFailureType.AUTHENTICATION);
      expect(AiModelConfig.classifyFailure(new Error('UNAUTHENTICATED'))).toBe(AiFailureType.AUTHENTICATION);
      expect(AiModelConfig.classifyFailure(new Error('PERMISSION_DENIED'))).toBe(AiFailureType.AUTHENTICATION);
    });

    it('classifies rate limiting, and does not confuse it with a missing model', () => {
      expect(AiModelConfig.classifyFailure({ status: 429 })).toBe(AiFailureType.RATE_LIMITED);
      expect(AiModelConfig.classifyFailure(new Error('Rate limit reached'))).toBe(AiFailureType.RATE_LIMITED);
      expect(AiModelConfig.classifyFailure(new Error('Quota exceeded'))).toBe(AiFailureType.RATE_LIMITED);
      expect(AiModelConfig.classifyFailure(new Error('RESOURCE_EXHAUSTED'))).toBe(AiFailureType.RATE_LIMITED);
    });

    it('classifies genuinely unavailable models', () => {
      expect(AiModelConfig.classifyFailure({ status: 404 })).toBe(AiFailureType.MODEL_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure({ error: { code: 'model_not_found' } })).toBe(AiFailureType.MODEL_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure({ error: { code: 'model_decommissioned' } })).toBe(AiFailureType.MODEL_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure(new Error('The model foo does not exist'))).toBe(AiFailureType.MODEL_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure(new Error('models/gemini-3.7-flash is not found'))).toBe(AiFailureType.MODEL_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure(new Error('This model is no longer available'))).toBe(AiFailureType.MODEL_UNAVAILABLE);
    });

    it('classifies provider outages separately from model removal', () => {
      expect(AiModelConfig.classifyFailure({ status: 503 })).toBe(AiFailureType.PROVIDER_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure({ status: 500 })).toBe(AiFailureType.PROVIDER_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure({ code: 503 })).toBe(AiFailureType.PROVIDER_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure(new Error('Service Unavailable'))).toBe(AiFailureType.PROVIDER_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure(new Error('The model is overloaded'))).toBe(AiFailureType.PROVIDER_UNAVAILABLE);
      expect(AiModelConfig.classifyFailure(new Error('high demand, try again later'))).toBe(AiFailureType.PROVIDER_UNAVAILABLE);
    });

    it('classifies invalid requests', () => {
      expect(AiModelConfig.classifyFailure({ status: 400 })).toBe(AiFailureType.INVALID_REQUEST);
      expect(AiModelConfig.classifyFailure({ status: 422 })).toBe(AiFailureType.INVALID_REQUEST);
      expect(AiModelConfig.classifyFailure(new Error('context length exceeded'))).toBe(AiFailureType.INVALID_REQUEST);
    });

    it('falls back to UNKNOWN for unrecognized failures', () => {
      expect(AiModelConfig.classifyFailure(new Error('something inexplicable'))).toBe(AiFailureType.UNKNOWN);
      expect(AiModelConfig.classifyFailure({})).toBe(AiFailureType.UNKNOWN);
    });
  });

  describe('Error Detection (legacy predicates)', () => {
    it('identifies Groq 404 and model_not_found errors', () => {
      expect(AiModelConfig.isGroqModelError({ status: 404 })).toBe(true);
      expect(AiModelConfig.isGroqModelError({ error: { code: 'model_not_found' } })).toBe(true);
      expect(AiModelConfig.isGroqModelError(new Error('The model llama-3.3-70b-versatile does not exist'))).toBe(true);
      expect(AiModelConfig.isGroqModelError(new Error('Rate limit 429'))).toBe(false);
    });

    it('identifies Gemini 404, not found, and no longer available errors', () => {
      expect(AiModelConfig.isGeminiModelError({ status: 404 })).toBe(true);
      expect(AiModelConfig.isGeminiModelError(new Error('models/gemini-3.7-flash is not found'))).toBe(true);
      expect(AiModelConfig.isGeminiModelError(new Error('This model models/gemini-2.5-flash is no longer available'))).toBe(true);
      expect(AiModelConfig.isGeminiModelError(new Error('Quota exceeded'))).toBe(false);
    });

    it('no longer treats rate limits or outages as model errors', () => {
      // Previously 429 and 503 returned true here, which caused model hopping.
      expect(AiModelConfig.isGeminiModelError({ status: 429 })).toBe(false);
      expect(AiModelConfig.isGeminiModelError({ status: 503 })).toBe(false);
      expect(AiModelConfig.isGroqModelError({ status: 429 })).toBe(false);
      // Previously 400 returned true for Groq.
      expect(AiModelConfig.isGroqModelError({ status: 400 })).toBe(false);
    });
  });

  describe('Backoff', () => {
    it('grows exponentially from the base delay', () => {
      expect(AiModelConfig.computeBackoffMs(0)).toBe(AiModelConfig.BASE_BACKOFF_MS);
      expect(AiModelConfig.computeBackoffMs(1)).toBe(AiModelConfig.BASE_BACKOFF_MS * 2);
      expect(AiModelConfig.computeBackoffMs(2)).toBe(AiModelConfig.BASE_BACKOFF_MS * 4);
    });

    it('never exceeds MAX_BACKOFF_MS however many attempts occur', () => {
      for (const attempt of [5, 10, 50, 1000]) {
        expect(AiModelConfig.computeBackoffMs(attempt)).toBeLessThanOrEqual(AiModelConfig.MAX_BACKOFF_MS);
      }
    });

    it('prefers a provider-supplied retry hint over the computed delay', () => {
      expect(AiModelConfig.computeBackoffMs(0, 3000)).toBe(3000);
    });

    it('clamps an absurd retry hint to MAX_BACKOFF_MS', () => {
      expect(AiModelConfig.computeBackoffMs(0, 999_999_999)).toBe(AiModelConfig.MAX_BACKOFF_MS);
    });

    it('reads Retry-After from a plain header object', () => {
      expect(AiModelConfig.extractRetryAfterMs({ headers: { 'retry-after': '2' } })).toBe(2000);
    });

    it('reads Retry-After from a Headers-like object', () => {
      const err = { response: { headers: { get: (k: string) => (k === 'retry-after' ? '3' : null) } } };
      expect(AiModelConfig.extractRetryAfterMs(err)).toBe(3000);
    });

    it("reads Gemini's RetryInfo retryDelay", () => {
      const err = {
        errorDetails: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '5s' }]
      };
      expect(AiModelConfig.extractRetryAfterMs(err)).toBe(5000);
    });

    it('returns undefined when no hint is present', () => {
      expect(AiModelConfig.extractRetryAfterMs(new Error('nope'))).toBeUndefined();
    });

    it('clamps a header hint to MAX_BACKOFF_MS', () => {
      expect(AiModelConfig.extractRetryAfterMs({ headers: { 'retry-after': '9999' } })).toBe(
        AiModelConfig.MAX_BACKOFF_MS
      );
    });
  });

  describe('resolveGroqFallbacks', () => {
    it('returns ranked preferred models intersected with available models', async () => {
      const available = [
        { id: 'openai/gpt-oss-20b' },
        { id: 'openai/gpt-oss-120b' },
        { id: 'some-other-model' }
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: available })
      }));

      const result = await AiModelConfig.resolveGroqFallbacks('test-key');
      // Should be intersection ordered by GROQ_PREFERRED_MODELS, not by API order
      expect(result).toContain('openai/gpt-oss-120b');
      expect(result).toContain('openai/gpt-oss-20b');
      expect(result).not.toContain('some-other-model');
      expect(result.indexOf('openai/gpt-oss-120b')).toBeLessThan(result.indexOf('openai/gpt-oss-20b'));
    });

    it('excludes the specified model from results', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'openai/gpt-oss-120b' }, { id: 'openai/gpt-oss-20b' }] })
      }));

      const result = await AiModelConfig.resolveGroqFallbacks('test-key', 'openai/gpt-oss-120b');
      expect(result).not.toContain('openai/gpt-oss-120b');
      expect(result).toContain('openai/gpt-oss-20b');
    });

    it('falls back to static preference list when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
      const result = await AiModelConfig.resolveGroqFallbacks('test-key');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe(AiModelConfig.GROQ_PREFERRED_MODELS[0]);
    });

    it('still performs discovery (model list is not hardcoded past the request)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'openai/gpt-oss-20b' }] })
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await AiModelConfig.resolveGroqFallbacks('test-key');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/models',
        expect.objectContaining({ headers: { Authorization: 'Bearer test-key' } })
      );
      // Only the discovered model survives the intersection.
      expect(result).toEqual(['openai/gpt-oss-20b']);
    });
  });

  describe('executeGroqWithFallback', () => {
    it('executes successfully on primary model without fallback', async () => {
      const op = vi.fn().mockResolvedValue('ok');
      const model = AiModelConfig.GROQ_PREFERRED_MODELS[0];
      const res = await AiModelConfig.executeGroqWithFallback(model, op);

      expect(res).toEqual({ result: 'ok', activeModel: model });
      expect(op).toHaveBeenCalledTimes(1);
      expect(op).toHaveBeenCalledWith(model);
    });

    it('retries with fallback model when primary model returns 404 (no apiKey → static list)', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce({ status: 404, message: 'model_not_found' })
        .mockResolvedValueOnce('fallback-ok');

      const res = await AiModelConfig.executeGroqWithFallback('a-retired-model', op);

      expect(res.result).toBe('fallback-ok');
      expect(op).toHaveBeenCalledTimes(2);
      expect(op).toHaveBeenNthCalledWith(1, 'a-retired-model');
      // Second call uses next model in static GROQ_PREFERRED_MODELS
      expect(AiModelConfig.GROQ_PREFERRED_MODELS).toContain(op.mock.calls[1][0]);
    });

    it('does not retry a 404 on the same model before switching', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce({ status: 404 })
        .mockResolvedValueOnce('ok');

      await AiModelConfig.executeGroqWithFallback(AiModelConfig.GROQ_PREFERRED_MODELS[0], op);

      expect(op.mock.calls[0][0]).not.toBe(op.mock.calls[1][0]);
      expect(AiModelConfig.sleep).not.toHaveBeenCalled();
    });

    it('backs off on the SAME model for a 429 rather than hopping immediately', async () => {
      const model = AiModelConfig.GROQ_PREFERRED_MODELS[0];
      const op = vi
        .fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValueOnce('recovered');

      const res = await AiModelConfig.executeGroqWithFallback(model, op);

      expect(res).toEqual({ result: 'recovered', activeModel: model });
      expect(op).toHaveBeenCalledTimes(3);
      // Crucially: every attempt used the originally requested model.
      expect(op.mock.calls.every((c) => c[0] === model)).toBe(true);
      expect(AiModelConfig.sleep).toHaveBeenCalledTimes(2);
    });

    it('honors Retry-After when backing off a 429', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce({ status: 429, headers: { 'retry-after': '2' } })
        .mockResolvedValueOnce('ok');

      await AiModelConfig.executeGroqWithFallback(AiModelConfig.GROQ_PREFERRED_MODELS[0], op);

      expect(AiModelConfig.sleep).toHaveBeenCalledWith(2000);
    });

    it('switches model only after the 429 retry budget is spent', async () => {
      const model = AiModelConfig.GROQ_PREFERRED_MODELS[0];
      const budget = AiModelConfig.RETRYABLE_ATTEMPTS[AiFailureType.RATE_LIMITED]!;
      const op = vi.fn().mockRejectedValue({ status: 429 });

      await expect(AiModelConfig.executeGroqWithFallback(model, op)).rejects.toBeDefined();

      const perModelAttempts = budget + 1;
      const modelsTried = AiModelConfig.GROQ_PREFERRED_MODELS.length; // primary + 2 fallbacks
      expect(op).toHaveBeenCalledTimes(perModelAttempts * modelsTried);
      // Bounded: the first model is not retried indefinitely.
      expect(op.mock.calls.filter((c) => c[0] === model)).toHaveLength(perModelAttempts);
    });

    it('recovers on the same model after backing off a 503', async () => {
      const model = AiModelConfig.GROQ_PREFERRED_MODELS[0];
      const op = vi
        .fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValueOnce('ok');

      const res = await AiModelConfig.executeGroqWithFallback(model, op);

      expect(res.activeModel).toBe(model);
      expect(AiModelConfig.sleep).toHaveBeenCalledTimes(1);
    });

    it('re-throws non-model errors without retrying', async () => {
      const op = vi.fn().mockRejectedValue(new Error('Invalid API key (401)'));

      await expect(AiModelConfig.executeGroqWithFallback('openai/gpt-oss-120b', op)).rejects.toThrow(
        'Invalid API key (401)'
      );
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('fails fast on an invalid request without trying other models', async () => {
      const op = vi.fn().mockRejectedValue({ status: 400, message: 'invalid request' });

      await expect(AiModelConfig.executeGroqWithFallback('openai/gpt-oss-120b', op)).rejects.toBeDefined();
      expect(op).toHaveBeenCalledTimes(1);
      expect(AiModelConfig.sleep).not.toHaveBeenCalled();
    });

    it('gives an UNKNOWN failure exactly one retry before switching', async () => {
      const model = AiModelConfig.GROQ_PREFERRED_MODELS[0];
      const op = vi
        .fn()
        .mockRejectedValueOnce(new Error('something inexplicable'))
        .mockResolvedValueOnce('ok');

      await AiModelConfig.executeGroqWithFallback(model, op);

      expect(op).toHaveBeenCalledTimes(2);
      expect(op.mock.calls.every((c) => c[0] === model)).toBe(true);
    });
  });

  describe('executeGeminiWithFallback', () => {
    it('executes successfully on primary model without fallback', async () => {
      const op = vi.fn().mockResolvedValue('gemini-ok');
      const res = await AiModelConfig.executeGeminiWithFallback('gemini-3.7-flash', op);

      expect(res).toEqual({ result: 'gemini-ok', activeModel: 'gemini-3.7-flash' });
      expect(op).toHaveBeenCalledTimes(1);
      expect(op).toHaveBeenCalledWith('gemini-3.7-flash');
    });

    it('walks GEMINI_FALLBACK_MODELS in order when primary is not found', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce(new Error('models/gemini-3.7-flash is not found'))
        .mockRejectedValueOnce(new Error('models/gemini-3.6-flash is no longer available'))
        .mockResolvedValueOnce('fallback-gemini-ok');

      const res = await AiModelConfig.executeGeminiWithFallback('gemini-3.8-flash', op);

      expect(res.result).toBe('fallback-gemini-ok');
      expect(op).toHaveBeenCalledTimes(3);
      expect(op).toHaveBeenNthCalledWith(1, 'gemini-3.8-flash');
      expect(op).toHaveBeenNthCalledWith(2, AiModelConfig.GEMINI_FALLBACK_MODELS[0]);
    });

    it('backs off on the same model for a 503 instead of hopping through variants', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce({ status: 503, message: 'Service Unavailable' })
        .mockResolvedValueOnce('recovered');

      const res = await AiModelConfig.executeGeminiWithFallback('gemini-3.8-flash', op);

      expect(res).toEqual({ result: 'recovered', activeModel: 'gemini-3.8-flash' });
      expect(op).toHaveBeenCalledTimes(2);
      expect(op.mock.calls.every((c) => c[0] === 'gemini-3.8-flash')).toBe(true);
      expect(AiModelConfig.sleep).toHaveBeenCalledTimes(1);
    });

    it('backs off on the same model for a 429 instead of hopping through variants', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce({ status: 429, message: 'RESOURCE_EXHAUSTED' })
        .mockResolvedValueOnce('recovered');

      const res = await AiModelConfig.executeGeminiWithFallback('gemini-3.8-flash', op);

      expect(res.activeModel).toBe('gemini-3.8-flash');
      expect(op).toHaveBeenCalledTimes(2);
    });

    it('bounds total attempts when the whole provider stays unavailable', async () => {
      const op = vi.fn().mockRejectedValue({ status: 503 });

      await expect(AiModelConfig.executeGeminiWithFallback('gemini-3.8-flash', op)).rejects.toBeDefined();

      const budget = AiModelConfig.RETRYABLE_ATTEMPTS[AiFailureType.PROVIDER_UNAVAILABLE]!;
      const modelsTried = 1 + AiModelConfig.GEMINI_FALLBACK_MODELS.length;
      expect(op).toHaveBeenCalledTimes((budget + 1) * modelsTried);
    });

    it('fails fast on authentication without walking fallbacks', async () => {
      const op = vi.fn().mockRejectedValue({ status: 403, message: 'PERMISSION_DENIED' });

      await expect(AiModelConfig.executeGeminiWithFallback('gemini-3.8-flash', op)).rejects.toBeDefined();
      expect(op).toHaveBeenCalledTimes(1);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiModelConfig } from '../AiModelConfig';

describe('AiModelConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
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

  describe('Error Detection', () => {
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
  });

  describe('resolveGroqFallbacks', () => {
    it('returns ranked preferred models intersected with available models', async () => {
      const available = [
        { id: 'llama-3.3-70b-versatile' },
        { id: 'llama-3.1-8b-instant' },
        { id: 'some-other-model' }
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: available })
      }));

      const result = await AiModelConfig.resolveGroqFallbacks('test-key');
      // Should be intersection ordered by GROQ_PREFERRED_MODELS
      expect(result).toContain('llama-3.3-70b-versatile');
      expect(result).toContain('llama-3.1-8b-instant');
      expect(result).not.toContain('some-other-model');
      expect(result.indexOf('llama-3.3-70b-versatile')).toBeLessThan(result.indexOf('llama-3.1-8b-instant'));
    });

    it('excludes the specified model from results', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'llama-3.3-70b-versatile' }, { id: 'llama-3.1-8b-instant' }] })
      }));

      const result = await AiModelConfig.resolveGroqFallbacks('test-key', 'llama-3.3-70b-versatile');
      expect(result).not.toContain('llama-3.3-70b-versatile');
      expect(result).toContain('llama-3.1-8b-instant');
    });

    it('falls back to static preference list when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
      const result = await AiModelConfig.resolveGroqFallbacks('test-key');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe(AiModelConfig.GROQ_PREFERRED_MODELS[0]);
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

      const res = await AiModelConfig.executeGroqWithFallback('llama-3.3-70b-versatile', op);

      expect(res.result).toBe('fallback-ok');
      expect(op).toHaveBeenCalledTimes(2);
      expect(op).toHaveBeenNthCalledWith(1, 'llama-3.3-70b-versatile');
      // Second call uses next model in static GROQ_PREFERRED_MODELS excluding the failed one
      expect(AiModelConfig.GROQ_PREFERRED_MODELS).toContain(op.mock.calls[1][0]);
    });

    it('re-throws non-model errors without retrying', async () => {
      const op = vi.fn().mockRejectedValue(new Error('Invalid API key (401)'));

      await expect(AiModelConfig.executeGroqWithFallback('llama-3.3-70b-versatile', op)).rejects.toThrow(
        'Invalid API key (401)'
      );
      expect(op).toHaveBeenCalledTimes(1);
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
  });
});

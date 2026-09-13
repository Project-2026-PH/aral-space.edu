interface OpenRouterTextMessage {
  role: 'system' | 'user';
  content: string | Array<{ type: 'text' | 'file'; text?: string; file?: { filename: string; file_data: string } }>;
}

export interface OpenRouterJsonRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  file?: { filename: string; base64: string };
  temperature?: number;
}

export const REVIEWER_OPENROUTER_MODEL = 'nex-agi/nex-n2.5-mini:free';

export class OpenRouterRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly model: string,
    providerMessage?: string
  ) {
    const detail = providerMessage?.trim();
    super(`OpenRouter request failed with status ${status} for model "${model}"${detail ? `: ${detail}` : ''}`);
    this.name = 'OpenRouterRequestError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OpenRouterClient {
  private readonly apiKey = process.env.OPENROUTER_API_KEY;
  private readonly endpoint = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async completeJson<T>(request: OpenRouterJsonRequest): Promise<T> {
    if (!this.apiKey) throw new Error('OpenRouter is not configured');

    const structuredPrompt = [
      request.userPrompt,
      'Return only one valid JSON object matching this shape:',
      JSON.stringify(request.schema)
    ].join('\n\n');
    const messages: OpenRouterTextMessage[] = [
      { role: 'system', content: request.systemPrompt }
    ];
    if (request.file) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: structuredPrompt },
          {
            type: 'file',
            file: {
              filename: request.file.filename,
              file_data: `data:application/pdf;base64,${request.file.base64}`
            }
          }
        ]
      });
    } else {
      messages.push({ role: 'user', content: structuredPrompt });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(process.env.OPENROUTER_HTTP_REFERER ? { 'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER } : {}),
          ...(process.env.OPENROUTER_APP_NAME ? { 'X-Title': process.env.OPENROUTER_APP_NAME } : {})
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          temperature: request.temperature ?? 0.2
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        let providerMessage: string | undefined;
        try {
          const payload = await response.json() as any;
          const message = payload?.error?.message || payload?.message;
          if (typeof message === 'string') {
            providerMessage = message.replace(/\s+/g, ' ').slice(0, 300);
          }
        } catch {
          // Some provider failures return an empty or non-JSON body.
        }
        throw new OpenRouterRequestError(response.status, request.model, providerMessage);
      }
      const payload = await response.json() as any;
      const rawContent = payload?.choices?.[0]?.message?.content;
      if (typeof rawContent !== 'string') throw new Error('OpenRouter returned no JSON content');
      const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        throw new Error('OpenRouter returned malformed JSON');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('OpenRouter request timed out');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

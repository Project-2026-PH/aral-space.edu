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

export class OpenRouterClient {
  private readonly apiKey = process.env.OPENROUTER_API_KEY;
  private readonly endpoint = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async completeJson<T>(request: OpenRouterJsonRequest): Promise<T> {
    if (!this.apiKey) throw new Error('OpenRouter is not configured');

    const messages: OpenRouterTextMessage[] = [
      { role: 'system', content: request.systemPrompt }
    ];
    if (request.file) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: request.userPrompt },
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
      messages.push({ role: 'user', content: request.userPrompt });
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
          temperature: request.temperature ?? 0.2,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: request.schemaName,
              strict: true,
              schema: request.schema
            }
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`OpenRouter request failed with status ${response.status}`);
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

import { GoogleGenAI } from '@google/genai';
import { AIUnavailableError, type AIProvider, type JsonRequest, type JsonResult } from './ai.types';

type Options = { apiKey: string; models: string[]; timeoutMs: number };

/**
 * Gemini via Google's official SDK, using structured output: the response
 * must match a JSON Schema, so we get data, not prose to parse.
 *
 * Resilience: primary → primary again (after 400 ms) → fallback model. An
 * attempt moves on when the model is overloaded (429/503), errors (5xx),
 * times out, has been retired (404 — skips the same-model retry), or returns
 * text that isn't JSON. Bad requests (400) are our bug and are not retried.
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(private readonly options: Options) {
    this.client = new GoogleGenAI({ apiKey: options.apiKey });
  }

  async generateJson(request: JsonRequest): Promise<JsonResult> {
    const attempts: string[] = [];
    const [primary, ...fallbacks] = this.options.models;
    // Free-tier overload is often momentary: retry the primary once after a
    // short pause, then move to the fallback model(s).
    const plan = [primary!, primary!, ...fallbacks];

    for (const [index, model] of plan.entries()) {
      // A retired/unknown model won't recover on retry — skip straight on.
      if (index === 1 && attempts[0]?.endsWith('HTTP 404')) continue;
      if (index === 1) await new Promise((resolve) => setTimeout(resolve, 400));

      const started = Date.now();
      try {
        const response = await this.client.models.generateContent({
          model,
          contents: request.prompt,
          config: {
            systemInstruction: request.system,
            responseMimeType: 'application/json',
            responseJsonSchema: request.schema,
            temperature: request.temperature ?? 0,
            abortSignal: AbortSignal.timeout(this.options.timeoutMs),
          },
        });

        const data = JSON.parse(response.text ?? '');
        return {
          data,
          model,
          latencyMs: Date.now() - started,
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
          usedFallback: model !== primary,
        };
      } catch (error) {
        const reason = describe(error);
        attempts.push(`${model}: ${reason}`);
        if (!isRetryable(error)) break;
      }
    }

    throw new AIUnavailableError(attempts);
  }
}

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : undefined;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof SyntaxError) return true; // model returned non-JSON
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return true;
  const status = statusOf(error);
  return status === undefined || status === 404 || status === 429 || status >= 500;
}

function describe(error: unknown): string {
  if (error instanceof SyntaxError) return 'invalid JSON';
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'timeout';
  const status = statusOf(error);
  return status ? `HTTP ${status}` : error instanceof Error ? error.name : 'unknown error';
}

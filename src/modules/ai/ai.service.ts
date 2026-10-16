import { z } from 'zod';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { GeminiProvider } from './gemini.provider';
import { AIUnavailableError, type AIProvider, type JsonRequest } from './ai.types';

function createProvider(): AIProvider | null {
  if (env.AI_PROVIDER === 'none' || !env.GEMINI_API_KEY) return null;
  return new GeminiProvider({
    apiKey: env.GEMINI_API_KEY,
    models: [env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL],
    timeoutMs: env.AI_TIMEOUT_MS,
  });
}

const provider = createProvider();

export const aiStatus = () => ({
  enabled: provider !== null,
  provider: provider?.name ?? null,
  model: provider ? env.GEMINI_MODEL : null,
});

/**
 * Ask the model for JSON that matches `outputSchema`, then validate it with
 * the same Zod schema on our side. The model is never trusted: anything that
 * doesn't validate is rejected (and can never reach a database query).
 *
 * Logs one line per call with timing and token counts — but never the
 * prompt or the output, which may contain patient names.
 */
export async function generateValidated<S extends z.ZodType>(request: Omit<JsonRequest, 'schema'>, outputSchema: S): Promise<z.output<S>> {
  if (!provider) throw new ApiError(503, 'AI_DISABLED', 'AI features are not configured on this server.');

  try {
    const result = await provider.generateJson({ ...request, schema: z.toJSONSchema(outputSchema, { target: 'draft-7', io: 'input' }) });
    const parsed = outputSchema.safeParse(result.data);
    log(request.feature, {
      model: result.model,
      ms: result.latencyMs,
      tokensIn: result.inputTokens,
      tokensOut: result.outputTokens,
      fallback: result.usedFallback,
      outcome: parsed.success ? 'ok' : 'invalid-output',
    });
    if (!parsed.success) throw unavailable();
    return parsed.data;
  } catch (error) {
    if (error instanceof AIUnavailableError) {
      log(request.feature, { outcome: 'unavailable', attempts: error.attempts.join(' | ') });
      throw unavailable();
    }
    throw error;
  }
}

const unavailable = () =>
  new ApiError(503, 'AI_UNAVAILABLE', 'The AI assistant is busy right now. Please try again, or use the filters.');

function log(feature: string, fields: Record<string, unknown>) {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`);
  console.log(`[ai] feature=${feature} ${parts.join(' ')}`);
}

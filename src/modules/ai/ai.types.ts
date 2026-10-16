// The provider-agnostic contract. Features (search, insights, intake) talk to
// this interface only, so swapping Gemini for another model provider means
// writing one new class — no feature code changes.

export type JsonRequest = {
  /** Which feature is calling — used in logs and metrics only. */
  feature: 'search' | 'insights' | 'intake';
  /** Instructions: role, rules, allowed values. */
  system: string;
  /** The user-specific input. */
  prompt: string;
  /** JSON Schema the model's output must follow (structured output). */
  schema: object;
  temperature?: number;
};

export type JsonResult = {
  data: unknown;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** True when the primary model failed and a fallback answered. */
  usedFallback: boolean;
};

export interface AIProvider {
  readonly name: string;
  generateJson(request: JsonRequest): Promise<JsonResult>;
}

/** Every model attempt failed (overloaded, timed out, invalid output…). */
export class AIUnavailableError extends Error {
  constructor(public readonly attempts: string[]) {
    super('AI provider unavailable');
    this.name = 'AIUnavailableError';
  }
}

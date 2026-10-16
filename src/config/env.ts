import 'dotenv/config';
import { z } from 'zod';

// Validate env once at boot: a missing/typo'd variable fails fast with a clear
// message instead of surfacing later as an obscure runtime error.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().startsWith('mongodb', 'MONGODB_URI must be a mongodb:// or mongodb+srv:// URI'),
  // Set explicitly so a URI without a path never silently falls back to `test`.
  MONGODB_DB_NAME: z.string().min(1).default('doctor_tracker'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

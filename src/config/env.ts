import 'dotenv/config';
import { z } from 'zod';

// JWT lifetimes like "15m", "12h", "7d".
const duration = z.string().regex(/^\d+[smhd]$/, 'Use a duration like 15m, 12h or 7d');

// Validate env once at boot: a missing/typo'd variable fails fast with a clear
// message instead of surfacing later as an obscure runtime error.
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().startsWith('mongodb', 'MONGODB_URI must be a mongodb:// or mongodb+srv:// URI'),
    // Set explicitly so a URI without a path never silently falls back to `test`.
    MONGODB_DB_NAME: z.string().min(1).default('doctor_tracker'),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:3000'),

    // Separate secrets: a leaked access secret can't be used to mint refresh tokens.
    JWT_ACCESS_SECRET: z.string().min(32, 'Use at least 32 random characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'Use at least 32 random characters'),
    JWT_ACCESS_EXPIRES_IN: duration.default('15m'),
    JWT_REFRESH_EXPIRES_IN: duration.default('7d'),
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    path: ['JWT_REFRESH_SECRET'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

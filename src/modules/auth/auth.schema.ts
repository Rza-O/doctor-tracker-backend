import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email().max(254).toLowerCase(),
  // No strength rules here — only existing accounts log in. The max length
  // stops oversized payloads from being hashed.
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

import { z } from 'zod';

export const STAT_RANGES = ['30d', '90d', '12m'] as const;
export type StatRange = (typeof STAT_RANGES)[number];

export const statsQuery = z.object({
  // 30d → daily points, 90d → weekly, 12m → monthly.
  range: z.enum(STAT_RANGES).default('12m'),
});

import { Router, type Request, type Response } from 'express';
import { validate } from '../../middleware/validate';
import { cached } from '../../utils/cache';
import { statsQuery, type StatRange } from './stats.schema';
import { buildDashboardStats } from './stats.service';

// Dashboard numbers don't need to be real-time to the second: a short cache
// makes repeat visits instant and keeps load off the database.
const STATS_TTL_MS = 60_000;

export const statsRoutes = Router();

statsRoutes.get('/', validate({ query: statsQuery }), async (req: Request, res: Response) => {
  const { range } = req.query as unknown as { range: StatRange };
  const data = await cached(`stats:${range}`, STATS_TTL_MS, () => buildDashboardStats(range));
  res.json({ success: true, data });
});

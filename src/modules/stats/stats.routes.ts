import { Router, type Request, type Response } from 'express';
import { validate } from '../../middleware/validate';
import { statsQuery, type StatRange } from './stats.schema';
import { getDashboardStats } from './stats.service';

export const statsRoutes = Router();

statsRoutes.get('/', validate({ query: statsQuery }), async (req: Request, res: Response) => {
  const { range } = req.query as unknown as { range: StatRange };
  res.json({ success: true, data: await getDashboardStats(range) });
});

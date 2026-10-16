import { Router } from 'express';
import type { z } from 'zod';
import { getInsights, insightsQuery } from './ai.insights';
import { aiLimiter } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { askFilters, askSchema } from './ai.search';
import { aiStatus } from './ai.service';

// Mounted behind the global requireAuth. Every AI endpoint is read-only from
// the database's point of view: it returns suggestions, never writes.
export const aiRoutes = Router();

/** Lets the frontend hide AI UI when the server has no AI configured. */
aiRoutes.get('/status', (_req, res) => {
  res.json({ success: true, data: aiStatus() });
});

/** Plain English → validated list filters for the Patients or Doctors page. */
aiRoutes.post('/search', aiLimiter(20), validate({ body: askSchema }), async (req, res) => {
  const data = await askFilters(req.body);
  res.json({ success: true, data });
});

/**
 * Dashboard insights from aggregated statistics only (cached 10 min per
 * period; ?refresh=1 regenerates). Rate-limited since a refresh costs a model call.
 */
aiRoutes.get('/insights', aiLimiter(10), validate({ query: insightsQuery }), async (req, res) => {
  const { range, refresh } = req.query as unknown as z.output<typeof insightsQuery>;
  res.json({ success: true, data: await getInsights(range, refresh) });
});

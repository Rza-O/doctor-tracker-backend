import { Router } from 'express';
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

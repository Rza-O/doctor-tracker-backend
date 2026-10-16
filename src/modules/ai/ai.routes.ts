import { Router } from 'express';
import { aiStatus } from './ai.service';

// Mounted behind the global requireAuth. Feature endpoints (search, insights,
// intake) are added in the following steps.
export const aiRoutes = Router();

/** Lets the frontend hide AI UI when the server has no AI configured. */
aiRoutes.get('/status', (_req, res) => {
  res.json({ success: true, data: aiStatus() });
});

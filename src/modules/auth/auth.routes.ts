import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { loginLimiter } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import * as auth from './auth.controller';
import { loginSchema } from './auth.schema';

export const authRoutes = Router();

authRoutes.post('/login', loginLimiter, validate({ body: loginSchema }), auth.login);
authRoutes.post('/refresh', auth.refresh);
authRoutes.post('/logout', auth.logout);
authRoutes.get('/me', requireAuth, auth.me);

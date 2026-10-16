import type { Role } from '../constants/domain';

// Adds the authenticated user (set by requireAuth) to Express's Request type.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export {};

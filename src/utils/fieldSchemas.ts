import { z } from 'zod';

// Field rules shared by more than one module's request bodies.

export const personName = z.string().trim().min(2, 'Name is too short').max(100);

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,19}$/, 'Enter a valid phone number');

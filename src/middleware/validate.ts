import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };

/**
 * Validates and normalizes request input before the controller runs.
 * Invalid input throws a ZodError, which errorHandler turns into a 400 with
 * per-field messages. Controllers can trust req.body / req.query / req.params.
 *
 *   router.post('/login', validate({ body: loginSchema }), login)
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    // In Express 5 req.query and req.params are getters, so they can't be
    // reassigned; defining an own property replaces them with the parsed values
    // (e.g. "?page=2" becomes the number 2).
    if (schemas.query) Object.defineProperty(req, 'query', { value: schemas.query.parse(req.query) });
    if (schemas.params) Object.defineProperty(req, 'params', { value: schemas.params.parse(req.params) });
    next();
  };
}

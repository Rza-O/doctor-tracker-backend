import { z } from 'zod';

// Reusable Zod building blocks for list endpoints. Query strings arrive as
// text ("?page=2"), so these coerce, default and cap every value before it
// reaches a database query.

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  // Hard cap: nobody can ask for 1,000,000 rows in one request.
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

// Accepts "2026-01-31" or a full ISO timestamp.
const isoDate = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const dateRange = {
  from: isoDate.transform((s) => new Date(s)).optional(),
  // A bare date means "through the end of that day", so ?to=2026-01-31
  // includes everything admitted on the 31st.
  to: isoDate.transform((s) => new Date(s.length === 10 ? `${s}T23:59:59.999Z` : s)).optional(),
};

/** Turns optional from/to into a MongoDB range condition, or undefined. */
export function toDateFilter(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return { ...(from && { $gte: from }), ...(to && { $lte: to }) };
}

/**
 * "?sort=name" (ascending) or "?sort=-admissionDate" (descending), limited to
 * a whitelist so clients can't sort on arbitrary (unindexed) fields.
 *
 * Fields whose values can repeat (names, ages) get `_id` as a tiebreaker:
 * without a fully deterministic order, skip/limit pagination can show the
 * same row on two pages or skip one. Timestamp fields are effectively unique,
 * and adding `_id` there would stop MongoDB from using the date index to sort.
 */
export function sortSchema<F extends string>(fields: readonly F[], fallback: F | `-${F}`, unique: readonly F[] = []) {
  const allowed = fields.flatMap((f) => [f, `-${f}`]) as [string, ...string[]];
  return z
    .enum(allowed)
    .default(fallback)
    .transform((value) => {
      const desc = value.startsWith('-');
      const field = (desc ? value.slice(1) : value) as F;
      const direction = desc ? -1 : 1;
      const sort: Record<string, 1 | -1> = { [field]: direction };
      if (!unique.includes(field)) sort._id = direction;
      return sort;
    });
}

/** Optional comma-separated multi-select: "?condition=Asthma,Diabetes". */
export function csvEnum<T extends string>(values: readonly [T, ...T[]]) {
  return z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).min(1))
    .optional();
}

import type { FilterQuery, Schema } from 'mongoose';

// Stores the lowercased words of `name` in `nameTokens`
// ("Farhana Rahman" → ["farhana", "rahman"]) with a multikey index.
//
// Why: a case-insensitive "contains" regex (/rahm/i) cannot use an index, so
// MongoDB scans every document. An anchored prefix regex (/^rahm/) on an
// indexed, pre-lowercased field CAN walk the index range. Indexing each word
// separately lets the search match the start of ANY word — first or last name.
export function searchableName(schema: Schema) {
  schema.add({ nameTokens: { type: [String], select: false } });
  schema.index({ nameTokens: 1 });

  schema.pre('validate', function () {
    const name = this.get('name');
    if (typeof name === 'string') this.set('nameTokens', tokenize(name));
  });

  // Document hooks don't run for query updates, so mirror the logic there.
  schema.pre(['findOneAndUpdate', 'updateOne'], function () {
    const update = this.getUpdate() as Record<string, any> | null;
    const name = update?.name ?? update?.$set?.name;
    if (typeof name === 'string') this.set('nameTokens', tokenize(name));
  });
}

/**
 * Builds a filter where every word the user typed must prefix-match one of the
 * name's words: "farhana rah" → { nameTokens: { $all: [/^farhana/, /^rah/] } }.
 */
export function nameSearchFilter(term: string): FilterQuery<any> | null {
  const words = tokenize(term).slice(0, 5); // cap work per request
  if (words.length === 0) return null;
  return { nameTokens: { $all: words.map((w) => new RegExp(`^${escapeRegex(w)}`)) } };
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

// User input goes into a RegExp, so special characters must be escaped:
// otherwise ".*" would match everything and crafted patterns could cause ReDoS.
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import type { Schema } from 'mongoose';

// Keeps a lowercased copy of `name` in `nameLower`.
//
// Why: a case-insensitive regex (/term/i) cannot use an index efficiently, so
// MongoDB scans every document. An anchored, case-sensitive prefix regex on a
// pre-lowercased field (/^term/) CAN walk the index range, so search stays fast
// as the collection grows.
export function searchableName(schema: Schema) {
  schema.add({ nameLower: { type: String, select: false } });
  schema.index({ nameLower: 1 });

  schema.pre('validate', function () {
    const name = this.get('name');
    if (typeof name === 'string') this.set('nameLower', name.toLowerCase());
  });

  // Document hooks don't run for query updates, so mirror the logic there.
  schema.pre(['findOneAndUpdate', 'updateOne'], function () {
    const update = this.getUpdate() as Record<string, any> | null;
    const name = update?.name ?? update?.$set?.name;
    if (typeof name === 'string') this.set('nameLower', name.toLowerCase());
  });
}

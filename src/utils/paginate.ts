import type { FilterQuery, Model, PopulateOptions } from 'mongoose';

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Options = {
  page: number;
  limit: number;
  sort: Record<string, 1 | -1>;
  select?: string;
  populate?: PopulateOptions;
};

/**
 * Offset pagination with one consistent response shape for every list.
 *
 * - The page query and the count run in parallel (one round-trip of latency, not two).
 * - With no filter, the count uses collection metadata (estimatedDocumentCount)
 *   instead of counting every document.
 * - .lean() returns plain objects: no Mongoose document overhead per row.
 */
export async function paginate<T>(model: Model<any>, filter: FilterQuery<any>, opts: Options): Promise<Paginated<T>> {
  const { page, limit, sort, select, populate } = opts;

  let query = model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean();
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);

  const isUnfiltered = Object.keys(filter).length === 0;
  const [items, total] = await Promise.all([
    query.exec(),
    isUnfiltered ? model.estimatedDocumentCount() : model.countDocuments(filter),
  ]);

  return { items: items as T[], page, limit, total, totalPages: Math.ceil(total / limit) };
}

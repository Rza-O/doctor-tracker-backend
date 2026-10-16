import { z } from 'zod';
import { SPECIALIZATIONS } from '../../constants/domain';
import { personName, phone } from '../../utils/fieldSchemas';
import { csvEnum, dateRange, pagination, sortSchema } from '../../utils/querySchemas';

export const createDoctorSchema = z.object({
  // "Dr." is added by the UI; strip it if typed so names stay consistent and
  // searchable (see searchableName plugin).
  name: z
    .string()
    .trim()
    .transform((s) => s.replace(/^dr\.?\s+/i, ''))
    .pipe(personName),
  specialization: z.enum(SPECIALIZATIONS),
  hospital: z.string().trim().min(2).max(150),
  phone,
  email: z.email().max(254).toLowerCase(),
});

export const listDoctorsQuery = z.object({
  ...pagination,
  // from/to filter on the date the doctor joined (createdAt).
  ...dateRange,
  search: z.string().trim().max(100).optional(),
  specialization: csvEnum(SPECIALIZATIONS),
  hospital: z
    .string()
    .transform((s) => s.split(',').map((h) => h.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(150)).min(1).max(20))
    .optional(),
  sort: sortSchema(['createdAt', 'name'], '-createdAt', ['createdAt']),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuery>;

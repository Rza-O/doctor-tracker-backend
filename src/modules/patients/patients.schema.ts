import { z } from 'zod';
import { CONDITIONS, GENDERS, PATIENT_STATUSES, SEVERITIES } from '../../constants/domain';
import { personName, phone } from '../../utils/fieldSchemas';
import { csvEnum, dateRange, isoDate, objectId, pagination, sortSchema } from '../../utils/querySchemas';

// Email is optional. An empty form field arrives as "", which means "no email"
// (stored as null so an edit can clear it).
const optionalEmail = z
  .union([z.literal(''), z.email().max(254)])
  .nullable()
  .transform((v) => (v ? v.toLowerCase() : null));

// ISO strings only: z.coerce.date() would quietly turn null or 0 into 1970.
const admissionDate = isoDate
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() <= Date.now() + 60_000, 'Admission date cannot be in the future');

const patientFields = {
  name: personName,
  age: z.number().int().min(0).max(130),
  gender: z.enum(GENDERS),
  phone,
  email: optionalEmail.optional(),
  condition: z.enum(CONDITIONS),
  severity: z.enum(SEVERITIES),
  status: z.enum(PATIENT_STATUSES),
  admissionDate,
};

// POST /doctors/:id/patients — the doctor comes from the URL, not the body.
export const createPatientSchema = z.object({
  ...patientFields,
  severity: patientFields.severity.default('stable'),
  status: patientFields.status.default('admitted'),
  admissionDate: admissionDate.default(() => new Date()),
});

// PATCH /patients/:id — any subset of fields; may also move the patient to
// another doctor.
export const updatePatientSchema = z
  .object({ ...patientFields, doctor: objectId })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const listPatientsQuery = z
  .object({
    ...pagination,
    // from/to filter on admissionDate.
    ...dateRange,
    // Contains "@" → email prefix search; otherwise name-word search.
    search: z.string().trim().max(100).optional(),
    condition: csvEnum(CONDITIONS),
    severity: csvEnum(SEVERITIES),
    status: csvEnum(PATIENT_STATUSES),
    gender: csvEnum(GENDERS),
    doctor: objectId.optional(),
    ageMin: z.coerce.number().int().min(0).max(130).optional(),
    ageMax: z.coerce.number().int().min(0).max(130).optional(),
    sort: sortSchema(['admissionDate', 'name', 'age'], '-admissionDate', ['admissionDate']),
  })
  .refine((q) => q.ageMin === undefined || q.ageMax === undefined || q.ageMin <= q.ageMax, {
    message: 'ageMin must be less than or equal to ageMax',
    path: ['ageMin'],
  });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuery>;

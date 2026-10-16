import { type InferSchemaType, Schema, model } from 'mongoose';
import { CONDITIONS, GENDERS, PATIENT_STATUSES, SEVERITIES } from '../constants/domain';
import { searchableName } from './plugins/searchableName';

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, enum: GENDERS, required: true },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, lowercase: true, trim: true },
    condition: { type: String, enum: CONDITIONS, required: true },
    severity: { type: String, enum: SEVERITIES, default: 'stable', required: true },
    status: { type: String, enum: PATIENT_STATUSES, default: 'admitted', required: true },
    // A patient belongs to exactly one doctor.
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    admissionDate: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

patientSchema.plugin(searchableName);

// Indexes follow the ESR rule: Equality fields first, then the Sort field,
// then Range (date filters reuse the sort field).

// Doctor detail page: a doctor's patients, newest first. Also serves the
// patients-per-doctor aggregation and cascade deletes.
patientSchema.index({ doctor: 1, admissionDate: -1 });
// Doctor detail page filtered by condition.
patientSchema.index({ doctor: 1, condition: 1, admissionDate: -1 });
// Patients page filtered by condition / severity.
patientSchema.index({ condition: 1, admissionDate: -1 });
patientSchema.index({ severity: 1, admissionDate: -1 });
// Default list order, date-range filter and the time-series chart.
patientSchema.index({ admissionDate: -1 });
// Prefix search by email.
patientSchema.index({ email: 1 });

export type Patient = InferSchemaType<typeof patientSchema>;
export const PatientModel = model('Patient', patientSchema);

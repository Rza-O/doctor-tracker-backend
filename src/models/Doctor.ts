import { type InferSchemaType, Schema, model } from 'mongoose';
import { SPECIALIZATIONS } from '../constants/domain';
import { searchableName } from './plugins/searchableName';

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, enum: SPECIALIZATIONS, required: true },
    hospital: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true, versionKey: false },
);

doctorSchema.plugin(searchableName);

// Default list order + "joined between" date filter.
doctorSchema.index({ createdAt: -1 });
// Filter by specialization, newest first (Equality → Sort).
doctorSchema.index({ specialization: 1, createdAt: -1 });
// Filter by hospital.
doctorSchema.index({ hospital: 1 });

export type Doctor = InferSchemaType<typeof doctorSchema>;
export const DoctorModel = model('Doctor', doctorSchema);


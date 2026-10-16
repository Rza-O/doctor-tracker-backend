import type { FilterQuery, PopulateOptions } from 'mongoose';
import { PatientModel, type Patient } from '../../models/Patient';
import { nameSearchFilter } from '../../models/plugins/searchableName';
import { ApiError } from '../../utils/ApiError';
import { paginate } from '../../utils/paginate';
import { toDateFilter } from '../../utils/querySchemas';
import { assertDoctorExists } from '../doctors/doctors.service';
import type { CreatePatientInput, ListPatientsQuery, UpdatePatientInput } from './patients.schema';

// Doctor summary shown next to each patient. populate() fetches all doctors
// for a page in ONE extra query ({ _id: { $in: [...] } }), not one per row.
const withDoctor: PopulateOptions = { path: 'doctor', select: 'name specialization hospital' };

function buildFilter(q: ListPatientsQuery, doctorId?: string): FilterQuery<Patient> {
  const filter: FilterQuery<Patient> = {
    ...(q.condition && { condition: { $in: q.condition } }),
    ...(q.severity && { severity: { $in: q.severity } }),
    ...(q.status && { status: { $in: q.status } }),
    ...(q.gender && { gender: { $in: q.gender } }),
  };

  // The nested route's doctor (from the URL) wins over ?doctor=.
  const doctor = doctorId ?? q.doctor;
  if (doctor) filter.doctor = doctor;

  if (q.search) {
    if (q.search.includes('@')) {
      // Anchored prefix on the indexed email field.
      filter.email = new RegExp(`^${escapeRegex(q.search.toLowerCase())}`);
    } else {
      Object.assign(filter, nameSearchFilter(q.search));
    }
  }

  const admitted = toDateFilter(q.from, q.to);
  if (admitted) filter.admissionDate = admitted;

  if (q.ageMin !== undefined || q.ageMax !== undefined) {
    filter.age = { ...(q.ageMin !== undefined && { $gte: q.ageMin }), ...(q.ageMax !== undefined && { $lte: q.ageMax }) };
  }

  return filter;
}

export async function listPatients(q: ListPatientsQuery, doctorId?: string) {
  if (doctorId) await assertDoctorExists(doctorId);
  return paginate<Patient>(PatientModel, buildFilter(q, doctorId), {
    page: q.page,
    limit: q.limit,
    sort: q.sort,
    populate: withDoctor,
  });
}

export async function getPatient(id: string) {
  const patient = await PatientModel.findById(id).populate(withDoctor).lean();
  if (!patient) throw ApiError.notFound('Patient not found');
  return patient;
}

export async function createPatient(doctorId: string, input: CreatePatientInput) {
  await assertDoctorExists(doctorId);
  const created = await PatientModel.create({ ...input, doctor: doctorId });
  return getPatient(String(created._id));
}

export async function updatePatient(id: string, input: UpdatePatientInput) {
  if (input.doctor) await assertDoctorExists(input.doctor);

  // runValidators: enum/min/max rules also apply to updates, not just creates.
  // The searchableName query hook rebuilds nameTokens when `name` changes.
  const patient = await PatientModel.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true })
    .populate(withDoctor)
    .lean();
  if (!patient) throw ApiError.notFound('Patient not found');
  return patient;
}

export async function deletePatient(id: string) {
  const deleted = await PatientModel.findByIdAndDelete(id).select('_id').lean();
  if (!deleted) throw ApiError.notFound('Patient not found');
  return { _id: String(deleted._id) };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

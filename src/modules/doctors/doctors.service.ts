import { Types, type FilterQuery } from 'mongoose';
import { DoctorModel, type Doctor } from '../../models/Doctor';
import { PatientModel } from '../../models/Patient';
import { nameSearchFilter } from '../../models/plugins/searchableName';
import { ApiError } from '../../utils/ApiError';
import { paginate } from '../../utils/paginate';
import { toDateFilter } from '../../utils/querySchemas';
import type { CreateDoctorInput, ListDoctorsQuery } from './doctors.schema';

type DoctorRow = Doctor & { _id: Types.ObjectId; patientCount: number };

export async function listDoctors(q: ListDoctorsQuery) {
  const filter: FilterQuery<Doctor> = {
    ...(q.search && nameSearchFilter(q.search)),
    ...(q.specialization && { specialization: { $in: q.specialization } }),
    ...(q.hospital && { hospital: { $in: q.hospital } }),
  };
  const joined = toDateFilter(q.from, q.to);
  if (joined) filter.createdAt = joined;

  const page = await paginate<DoctorRow>(DoctorModel, filter, { page: q.page, limit: q.limit, sort: q.sort });

  // Patient counts for just this page's doctors: one grouped query using the
  // { doctor, admissionDate } index, instead of one count per row (N+1).
  const counts = await patientCounts(page.items.map((d) => d._id));
  page.items = page.items.map((d) => ({ ...d, patientCount: counts.get(String(d._id)) ?? 0 }));

  return page;
}

export async function getDoctor(id: string) {
  const doctor = await DoctorModel.findById(id).lean();
  if (!doctor) throw ApiError.notFound('Doctor not found');
  const patientCount = await PatientModel.countDocuments({ doctor: doctor._id });
  return { ...doctor, patientCount };
}

export async function createDoctor(input: CreateDoctorInput) {
  // Duplicate email → unique index error 11000 → errorHandler responds 409.
  const doctor = await DoctorModel.create(input);
  return { ...doctor.toJSON(), patientCount: 0 };
}

/** Throws 404 unless the doctor exists. Used by nested patient routes. */
export async function assertDoctorExists(id: string) {
  const exists = await DoctorModel.exists({ _id: id });
  if (!exists) throw ApiError.notFound('Doctor not found');
}

async function patientCounts(doctorIds: Types.ObjectId[]) {
  if (doctorIds.length === 0) return new Map<string, number>();
  const rows = await PatientModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

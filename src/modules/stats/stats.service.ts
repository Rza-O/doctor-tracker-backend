import { CONDITIONS, PATIENT_STATUSES, SEVERITIES, SPECIALIZATIONS } from '../../constants/domain';
import { DoctorModel } from '../../models/Doctor';
import { PatientModel } from '../../models/Patient';
import type { StatRange } from './stats.schema';

// All date grouping happens in Dhaka time so "October" means the clinic's
// October, not UTC's. Bangladesh has no daylight saving, so a fixed offset is
// exact for the JS-side bucket math.
const TZ = 'Asia/Dhaka';
const TZ_OFFSET_MS = 6 * 60 * 60 * 1000;

type Unit = 'day' | 'week' | 'month';
const RANGE_UNIT: Record<StatRange, Unit> = { '30d': 'day', '90d': 'week', '12m': 'month' };

type CountRow = { _id: string; count: number };

/**
 * Builds the whole dashboard. Independent aggregations run in parallel, each
 * able to use its own index; total latency ≈ the slowest one, not the sum.
 */
export async function buildDashboardStats(range: StatRange) {
  const now = new Date();
  const unit = RANGE_UNIT[range];
  const start = rangeStart(range, now);
  const { monthStart, lastMonthStart, lastMonthSamePoint } = monthWindows(now);

  // Every chart describes patients ADMITTED IN THE SELECTED PERIOD, so the
  // period switch changes all of them consistently. The KPI tiles are an
  // all-time snapshot and stay independent of it.
  const inPeriod = { admissionDate: { $gte: start } };

  const [
    totalDoctors,
    totalPatients,
    inCare,
    critical,
    newThisMonth,
    newLastMonthToDate,
    series,
    breakdowns,
    perDoctor,
    doctorsBySpec,
  ] = await Promise.all([
    DoctorModel.estimatedDocumentCount(),
    PatientModel.estimatedDocumentCount(),
    // All-time snapshot counts for the KPI tiles.
    PatientModel.countDocuments({ status: { $in: ['admitted', 'under-treatment'] } }),
    PatientModel.countDocuments({ severity: 'critical' }), // { severity, admissionDate } index
    // Both counts are index range scans on { admissionDate: -1 }.
    PatientModel.countDocuments({ admissionDate: { $gte: monthStart } }),
    PatientModel.countDocuments({ admissionDate: { $gte: lastMonthStart, $lt: lastMonthSamePoint } }),
    admissionsSeries(start, unit),
    patientBreakdowns(inPeriod),
    patientsPerDoctor(inPeriod),
    DoctorModel.aggregate<CountRow>([{ $group: { _id: '$specialization', count: { $sum: 1 } } }]),
  ]);

  const byStatus = fillCounts(breakdowns.byStatus, PATIENT_STATUSES);
  const bySeverity = fillCounts(breakdowns.bySeverity, SEVERITIES);

  return {
    range,
    generatedAt: now.toISOString(),
    // What the period-scoped sections cover, so the UI can say so.
    period: { from: start.toISOString(), admissions: bySeverity.reduce((sum, r) => sum + r.count, 0) },
    kpis: {
      totalDoctors,
      totalPatients,
      inCare,
      critical,
      avgPatientsPerDoctor: totalDoctors ? Math.round((totalPatients / totalDoctors) * 10) / 10 : 0,
      newThisMonth,
      newLastMonthToDate,
      // Month-to-date vs the same days of last month — comparing a half month
      // against a full month would always look like a drop.
      monthOverMonthChangePct: newLastMonthToDate
        ? Math.round(((newThisMonth - newLastMonthToDate) / newLastMonthToDate) * 1000) / 10
        : null,
    },
    admissionsOverTime: {
      unit,
      points: allBuckets(start, unit, now).map((bucket) => {
        const hit = series.find((s) => s._id === bucket);
        return { bucket, total: hit?.total ?? 0, critical: hit?.critical ?? 0 };
      }),
    },
    topDoctors: perDoctor.top,
    bySpecialization: SPECIALIZATIONS.map((s) => ({
      key: s,
      doctors: doctorsBySpec.find((r) => r._id === s)?.count ?? 0,
      patients: perDoctor.bySpecialization.find((r) => r._id === s)?.count ?? 0,
    })).sort((a, b) => b.patients - a.patients),
    byCondition: fillCounts(breakdowns.byCondition, CONDITIONS).sort((a, b) => b.count - a.count),
    bySeverity,
    byStatus,
  };
}

// ─── Aggregations ────────────────────────────────────────────────────────────

/** Admissions per day/week/month since `start`, plus how many were critical. */
function admissionsSeries(start: Date, unit: Unit) {
  return PatientModel.aggregate<{ _id: string; total: number; critical: number }>([
    { $match: { admissionDate: { $gte: start } } }, // index range scan
    {
      $group: {
        _id: bucketExpression(unit),
        total: { $sum: 1 },
        critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
      },
    },
  ]);
}

/**
 * The three breakdowns share ONE pass over the period's patients via $facet,
 * instead of three separate scans. The leading $match uses the admissionDate
 * index, so only the period's documents enter the facet.
 */
async function patientBreakdowns(match: Record<string, unknown>) {
  const group = (field: string) => [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }];
  const [result] = await PatientModel.aggregate<{ byCondition: CountRow[]; bySeverity: CountRow[]; byStatus: CountRow[] }>([
    { $match: match },
    { $facet: { byCondition: group('condition'), bySeverity: group('severity'), byStatus: group('status') } },
  ]);
  return result!;
}

/**
 * Patients grouped by doctor once, then reused for two answers: the top 10
 * doctors and patients per specialization. $lookup only joins ~100 grouped
 * rows (one per doctor), never the 10k patients.
 */
async function patientsPerDoctor(match: Record<string, unknown>) {
  const [result] = await PatientModel.aggregate<{
    top: { doctorId: string; name: string; specialization: string; patients: number }[];
    bySpecialization: CountRow[];
  }>([
    { $match: match },
    { $group: { _id: '$doctor', patients: { $sum: 1 } } },
    {
      $lookup: {
        from: DoctorModel.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'doctor',
        pipeline: [{ $project: { name: 1, specialization: 1 } }],
      },
    },
    { $unwind: '$doctor' },
    {
      $facet: {
        top: [
          { $sort: { patients: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, doctorId: '$_id', name: '$doctor.name', specialization: '$doctor.specialization', patients: 1 } },
        ],
        bySpecialization: [{ $group: { _id: '$doctor.specialization', count: { $sum: '$patients' } } }],
      },
    },
  ]);
  return result!;
}

// ─── Date helpers (Dhaka time) ───────────────────────────────────────────────

// "Local" dates hold Dhaka wall-clock time in their UTC fields, which makes
// calendar math (start of month, add a day) simple and DST-free.
const toLocal = (d: Date) => new Date(d.getTime() + TZ_OFFSET_MS);
const fromLocal = (d: Date) => new Date(d.getTime() - TZ_OFFSET_MS);

function bucketExpression(unit: Unit) {
  if (unit === 'month') return { $dateToString: { date: '$admissionDate', format: '%Y-%m', timezone: TZ } };
  if (unit === 'day') return { $dateToString: { date: '$admissionDate', format: '%Y-%m-%d', timezone: TZ } };
  // Weeks start on Sunday (the Bangladeshi work week); key = that Sunday's date.
  return {
    $dateToString: {
      date: { $dateTrunc: { date: '$admissionDate', unit: 'week', timezone: TZ, startOfWeek: 'sunday' } },
      format: '%Y-%m-%d',
      timezone: TZ,
    },
  };
}

function rangeStart(range: StatRange, now: Date): Date {
  const l = toLocal(now);
  const [y, m, d] = [l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()];
  if (range === '12m') return fromLocal(new Date(Date.UTC(y, m - 11, 1))); // 12 whole months incl. this one
  if (range === '30d') return fromLocal(new Date(Date.UTC(y, m, d - 29))); // 30 days incl. today
  const sunday = new Date(Date.UTC(y, m, d - 89));
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay()); // align to a whole week
  return fromLocal(sunday);
}

/** Every bucket key from start to now, so empty periods show as 0, not gaps. */
function allBuckets(start: Date, unit: Unit, now: Date): string[] {
  const keys: string[] = [];
  const cursor = toLocal(start);
  const end = toLocal(now);
  while (cursor <= end) {
    keys.push(unit === 'month' ? cursor.toISOString().slice(0, 7) : cursor.toISOString().slice(0, 10));
    if (unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (unit === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

function monthWindows(now: Date) {
  const l = toLocal(now);
  const monthStart = fromLocal(new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1)));
  const lastMonthStart = fromLocal(new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() - 1, 1)));
  const elapsed = now.getTime() - monthStart.getTime();
  // Same point in last month (capped at its end, e.g. 31st → 30th).
  const lastMonthSamePoint = new Date(Math.min(lastMonthStart.getTime() + elapsed, monthStart.getTime()));
  return { monthStart, lastMonthStart, lastMonthSamePoint };
}

/** Every enum value appears, in a stable order, even when its count is 0. */
function fillCounts(rows: CountRow[], keys: readonly string[]) {
  return keys.map((key) => ({ key, count: rows.find((r) => r._id === key)?.count ?? 0 }));
}

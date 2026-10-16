import { z } from 'zod';
import { CONDITIONS, type Condition, type Gender, type PatientStatus, type Severity } from '../../constants/domain';
import { connectDB, disconnectDB } from '../../config/db';
import { env, isProd } from '../../config/env';
import { DoctorModel } from '../../models/Doctor';
import { PatientModel } from '../../models/Patient';
import { UserModel } from '../../models/User';
import { hashPassword } from '../../utils/password';
import {
  FEMALE_FIRST_NAMES,
  HIGH_RISK_CONDITIONS,
  HOSPITALS,
  LAST_NAMES,
  MALE_FIRST_NAMES,
  OLDER_AGE_CONDITIONS,
  SEASONAL_CONDITIONS,
  SPECIALIZATION_CONDITIONS,
  SPECIALIZATION_WEIGHTS,
  WINTER_MONTHS,
} from './data';
import { createRandom } from './random';

const DOCTOR_COUNT = 100;
const PATIENT_COUNT = 10_000;
const BATCH_SIZE = 1_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const rand = createRandom(42);

// Seed-only variables are validated here, not in config/env.ts, so the
// running API never requires demo passwords to be configured.
const seedEnv = z
  .object({
    SEED_ADMIN_EMAIL: z.email(),
    SEED_ADMIN_PASSWORD: z.string().min(8),
    SEED_VIEWER_EMAIL: z.email(),
    SEED_VIEWER_PASSWORD: z.string().min(8),
  })
  .safeParse(process.env);

// ─── Builders ────────────────────────────────────────────────────────────────

function personName(gender: Gender) {
  const firstNames =
    gender === 'male' ? MALE_FIRST_NAMES : gender === 'female' ? FEMALE_FIRST_NAMES : rand.pick([MALE_FIRST_NAMES, FEMALE_FIRST_NAMES]);
  const first = rand.pick(firstNames);
  const last = rand.pick(LAST_NAMES);
  return { first, last, full: `${first} ${last}` };
}

function bdPhone() {
  return `+8801${rand.int(3, 9)}${rand.digits(8)}`;
}

function buildDoctors() {
  // First pass guarantees every specialization has at least one doctor;
  // the rest follow realistic weights.
  const specializations = [
    ...SPECIALIZATION_WEIGHTS.map(([s]) => s),
    ...Array.from({ length: DOCTOR_COUNT - SPECIALIZATION_WEIGHTS.length }, () => rand.weighted(SPECIALIZATION_WEIGHTS)),
  ];

  return specializations.map((specialization, i) => {
    const name = personName(rand.chance(0.5) ? 'male' : 'female');
    // Most doctors are established (joined 1–2 years ago); ~30% joined this year,
    // so the doctors' "joined between" filter has something to show.
    const daysAgo = rand.chance(0.7) ? rand.int(366, 720) : rand.int(30, 365);
    const createdAt = new Date(NOW - daysAgo * DAY_MS);
    return {
      name: name.full, // "Dr." is a display concern; storing it would break prefix search.
      specialization,
      hospital: rand.pick(HOSPITALS),
      phone: bdPhone(),
      email: `${name.first}.${name.last}.${i + 1}@example.com`.toLowerCase(),
      createdAt,
      updatedAt: createdAt,
    };
  });
}

/**
 * Picks an admission date with realistic shape, using rejection sampling:
 * draw a random day, keep it with a probability equal to its "weight".
 * - Growth trend: recent months are busier than a year ago.
 * - Weekly rhythm: fewer admissions on Friday/Saturday (Bangladeshi weekend).
 * - Seasonality: respiratory cases cluster in winter.
 * - Never before the doctor joined.
 */
function admissionDate(doctorJoined: Date, condition: Condition): Date {
  const tenureDays = Math.min(365, Math.floor((NOW - doctorJoined.getTime()) / DAY_MS));
  let candidate = new Date(NOW);

  for (let attempt = 0; attempt < 30; attempt++) {
    const daysAgo = rand.next() * tenureDays;
    candidate = new Date(NOW - daysAgo * DAY_MS);

    const trend = 0.55 + 0.45 * (1 - daysAgo / 365);
    const day = candidate.getDay();
    const weekly = day === 5 ? 0.6 : day === 6 ? 0.8 : 1;
    const seasonal = SEASONAL_CONDITIONS.includes(condition) && !WINTER_MONTHS.includes(candidate.getMonth()) ? 0.45 : 1;

    if (rand.next() < trend * weekly * seasonal) return candidate;
  }
  return candidate;
}

function severityFor(condition: Condition): Severity {
  return HIGH_RISK_CONDITIONS.includes(condition)
    ? rand.weighted([['stable', 35], ['moderate', 40], ['critical', 25]])
    : rand.weighted([['stable', 62], ['moderate', 30], ['critical', 8]]);
}

// Older admissions are mostly discharged; recent ones are still in care.
function statusFor(admittedAt: Date): PatientStatus {
  const daysAgo = (NOW - admittedAt.getTime()) / DAY_MS;
  if (daysAgo < 7) return rand.weighted([['admitted', 70], ['under-treatment', 30]]);
  if (daysAgo < 30) return rand.weighted([['admitted', 30], ['under-treatment', 50], ['discharged', 20]]);
  if (daysAgo < 90) return rand.weighted([['admitted', 10], ['under-treatment', 35], ['discharged', 55]]);
  return rand.weighted([['admitted', 3], ['under-treatment', 12], ['discharged', 85]]);
}

function ageFor(condition: Condition, isPediatric: boolean): number {
  if (isPediatric) return rand.int(1, 16);
  if (OLDER_AGE_CONDITIONS.includes(condition)) return rand.int(40, 85);
  return rand.int(18, 75);
}

type SeededDoctor = { _id: unknown; specialization: keyof typeof SPECIALIZATION_CONDITIONS; createdAt: Date };

function buildPatients(doctors: SeededDoctor[]) {
  // Some doctors are busier than others, and a doctor who joined recently has
  // had less time to see patients (otherwise their patients would all pile into
  // the last few months and distort the trend).
  const workload = doctors.map((d) => {
    const tenureShare = Math.min(1, (NOW - d.createdAt.getTime()) / DAY_MS / 365);
    return [d, (0.5 + rand.next() * 1.5) * tenureShare] as const;
  });

  return Array.from({ length: PATIENT_COUNT }, (_, i) => {
    const doctor = rand.weighted(workload);
    const condition = rand.chance(0.85) ? rand.pick(SPECIALIZATION_CONDITIONS[doctor.specialization]) : rand.pick(CONDITIONS);
    const gender = rand.weighted<Gender>([['male', 49], ['female', 49], ['other', 2]]);
    const name = personName(gender);
    const admittedAt = admissionDate(doctor.createdAt, condition);
    // Record typed in within a few hours of admission.
    const createdAt = new Date(admittedAt.getTime() + rand.int(0, 6 * 60) * 60 * 1000);

    return {
      name: name.full,
      age: ageFor(condition, doctor.specialization === 'Pediatrics'),
      gender,
      phone: bdPhone(),
      ...(rand.chance(0.6) && { email: `${name.first}.${name.last}.${i + 1}@example.com`.toLowerCase() }),
      condition,
      severity: severityFor(condition),
      status: statusFor(admittedAt),
      doctor: doctor._id,
      admissionDate: admittedAt,
      createdAt,
      updatedAt: createdAt,
    };
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function insertInBatches<T>(label: string, docs: T[], insert: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    await insert(docs.slice(i, i + BATCH_SIZE));
    process.stdout.write(`\r  ${label}: ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  if (!seedEnv.success) {
    console.error('Missing seed variables:\n' + z.prettifyError(seedEnv.error));
    process.exit(1);
  }
  if (isProd && !process.argv.includes('--force')) {
    console.error('Refusing to wipe data with NODE_ENV=production. Re-run with --force if you are sure.');
    process.exit(1);
  }

  const started = Date.now();
  await connectDB();
  console.log(`Seeding database "${env.MONGODB_DB_NAME}"...`);

  // 1. Start clean so the script can be re-run any time.
  await Promise.all([UserModel.deleteMany({}), DoctorModel.deleteMany({}), PatientModel.deleteMany({})]);
  console.log('  Cleared users, doctors, patients');

  // 2. Demo accounts.
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_VIEWER_EMAIL, SEED_VIEWER_PASSWORD } = seedEnv.data;
  await UserModel.create([
    { name: 'Admin User', email: SEED_ADMIN_EMAIL, passwordHash: await hashPassword(SEED_ADMIN_PASSWORD), role: 'admin' },
    { name: 'Viewer User', email: SEED_VIEWER_EMAIL, passwordHash: await hashPassword(SEED_VIEWER_PASSWORD), role: 'viewer' },
  ]);
  console.log('  Users: admin + viewer');

  // 3. Doctors (insertMany runs schema validation + the validate hook that fills nameLower).
  const doctors = await DoctorModel.insertMany(buildDoctors());
  console.log(`  Doctors: ${doctors.length}`);

  // 4. Patients, in batches to keep memory and request size bounded.
  const patients = buildPatients(doctors as unknown as SeededDoctor[]);
  await insertInBatches('Patients', patients, (batch) => PatientModel.insertMany(batch));

  // 5. Make sure indexes match the schemas (autoIndex is off in production).
  await Promise.all([UserModel.syncIndexes(), DoctorModel.syncIndexes(), PatientModel.syncIndexes()]);
  console.log('  Indexes synced');

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDB();
  process.exit(1);
});

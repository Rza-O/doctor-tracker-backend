// Closed value sets. Keeping these as fixed lists (not free text) gives us clean
// filter dropdowns, clean chart groupings, and a whitelist the AI layer must
// choose from when it turns natural language into filters.

export const ROLES = ['admin', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'Nephrology',
  'Neurology',
  'Oncology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
] as const;
export type Specialization = (typeof SPECIALIZATIONS)[number];

export const CONDITIONS = [
  'Arthritis',
  'Asthma',
  'Cancer',
  'Depression',
  'Diabetes',
  'Fracture',
  'Gastritis',
  'Heart Disease',
  'Hypertension',
  'Kidney Disease',
  'Migraine',
  'Respiratory Infection',
  'Skin Allergy',
  'Thyroid Disorder',
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const SEVERITIES = ['stable', 'moderate', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const PATIENT_STATUSES = ['admitted', 'under-treatment', 'discharged'] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

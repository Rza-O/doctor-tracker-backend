import type { Condition, Specialization } from '../../constants/domain';

// All names are fictional combinations of common Bangladeshi names.
export const MALE_FIRST_NAMES = [
  'Tanvir', 'Rakib', 'Arif', 'Imran', 'Sabbir', 'Fahim', 'Nafis', 'Shakil', 'Mahmud', 'Rafiq',
  'Jahid', 'Kamrul', 'Habib', 'Zahid', 'Masud', 'Shafiq', 'Anisur', 'Mehedi', 'Riyad', 'Sajid',
  'Tahmid', 'Ashraf', 'Nazmul', 'Mizanur', 'Faisal', 'Arjun', 'Sourav', 'Pritom', 'Rahat', 'Saif',
] as const;

export const FEMALE_FIRST_NAMES = [
  'Farhana', 'Nusrat', 'Tasnim', 'Sadia', 'Sharmin', 'Ayesha', 'Rumana', 'Nasrin', 'Tahmina', 'Shirin',
  'Fariha', 'Sumaiya', 'Maliha', 'Nabila', 'Lamia', 'Jannatul', 'Rokeya', 'Shabnam', 'Mahfuza', 'Anika',
  'Afroza', 'Ishrat', 'Raisa', 'Tania', 'Munira', 'Ananya', 'Priya', 'Mithila', 'Tisha', 'Orpa',
] as const;

export const LAST_NAMES = [
  'Rahman', 'Hossain', 'Ahmed', 'Islam', 'Chowdhury', 'Khan', 'Uddin', 'Sarkar', 'Talukder', 'Haque',
  'Karim', 'Siddique', 'Majumder', 'Miah', 'Alam', 'Kabir', 'Hasan', 'Mahmud', 'Das', 'Roy',
  'Saha', 'Barua', 'Chakraborty', 'Akhtar', 'Sheikh',
] as const;

// Fictional hospitals named after Dhaka areas — no real institutions.
export const HOSPITALS = [
  'Gulshan General Hospital',
  'Dhanmondi Medical Center',
  'Banani Specialized Hospital',
  'Uttara Care Hospital',
  'Mirpur City Hospital',
  'Bashundhara Health Institute',
  'Motijheel Central Clinic',
  'Mohakhali Community Hospital',
] as const;

// How many doctors of each specialty relative to others.
export const SPECIALIZATION_WEIGHTS: readonly (readonly [Specialization, number])[] = [
  ['General Medicine', 3],
  ['Cardiology', 2],
  ['Pediatrics', 2],
  ['Orthopedics', 2],
  ['Dermatology', 1],
  ['Endocrinology', 1],
  ['Gastroenterology', 1],
  ['Nephrology', 1],
  ['Neurology', 1],
  ['Oncology', 1],
  ['Psychiatry', 1],
  ['Pulmonology', 1],
];

// Conditions a specialist mostly treats, so the data is clinically plausible
// (a cardiologist's patients mostly have heart disease / hypertension).
export const SPECIALIZATION_CONDITIONS: Record<Specialization, readonly Condition[]> = {
  Cardiology: ['Heart Disease', 'Hypertension'],
  Dermatology: ['Skin Allergy'],
  Endocrinology: ['Diabetes', 'Thyroid Disorder'],
  Gastroenterology: ['Gastritis'],
  'General Medicine': ['Hypertension', 'Diabetes', 'Respiratory Infection', 'Migraine'],
  Nephrology: ['Kidney Disease', 'Hypertension'],
  Neurology: ['Migraine'],
  Oncology: ['Cancer'],
  Orthopedics: ['Fracture', 'Arthritis'],
  Pediatrics: ['Asthma', 'Respiratory Infection'],
  Psychiatry: ['Depression'],
  Pulmonology: ['Asthma', 'Respiratory Infection'],
};

// Conditions that skew toward more severe cases.
export const HIGH_RISK_CONDITIONS: readonly Condition[] = ['Cancer', 'Heart Disease', 'Kidney Disease'];

// Conditions that skew toward older patients.
export const OLDER_AGE_CONDITIONS: readonly Condition[] = [
  'Arthritis', 'Cancer', 'Heart Disease', 'Hypertension', 'Kidney Disease',
];

// Respiratory cases peak in the Bangladeshi winter (Dec–Feb).
export const SEASONAL_CONDITIONS: readonly Condition[] = ['Asthma', 'Respiratory Infection'];
export const WINTER_MONTHS = [11, 0, 1]; // JS months: Dec, Jan, Feb

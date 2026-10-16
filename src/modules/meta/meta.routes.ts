import { Router } from 'express';
import { CONDITIONS, GENDERS, PATIENT_STATUSES, SEVERITIES, SPECIALIZATIONS } from '../../constants/domain';
import { DoctorModel } from '../../models/Doctor';

// Single source for dropdown options, so the frontend never hard-codes lists
// and the AI layer validates against exactly the same values.
export const metaRoutes = Router();

metaRoutes.get('/', async (_req, res) => {
  // distinct() on an indexed field reads the index, not the documents.
  const hospitals = (await DoctorModel.distinct('hospital')).sort();
  res.json({
    success: true,
    data: {
      specializations: SPECIALIZATIONS,
      conditions: CONDITIONS,
      severities: SEVERITIES,
      statuses: PATIENT_STATUSES,
      genders: GENDERS,
      hospitals,
    },
  });
});

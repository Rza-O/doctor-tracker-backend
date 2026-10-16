import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParams } from '../../utils/querySchemas';
import * as patients from './patients.controller';
import { listPatientsQuery, updatePatientSchema } from './patients.schema';

// Mounted behind the global requireAuth. Creating a patient lives on the
// doctor routes (POST /doctors/:id/patients) because a patient always
// belongs to a doctor.
export const patientRoutes = Router();

patientRoutes.get('/', validate({ query: listPatientsQuery }), patients.list);
patientRoutes.get('/:id', validate({ params: idParams }), patients.getById);
patientRoutes.patch('/:id', requireRole('admin'), validate({ params: idParams, body: updatePatientSchema }), patients.update);
patientRoutes.delete('/:id', requireRole('admin'), validate({ params: idParams }), patients.remove);

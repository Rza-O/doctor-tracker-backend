import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParams } from '../../utils/querySchemas';
import * as doctors from './doctors.controller';
import { createDoctorSchema, listDoctorsQuery } from './doctors.schema';

// Mounted behind the global requireAuth: every route here needs a session;
// writes additionally need the admin role.
export const doctorRoutes = Router();

doctorRoutes.get('/', validate({ query: listDoctorsQuery }), doctors.list);
doctorRoutes.post('/', requireRole('admin'), validate({ body: createDoctorSchema }), doctors.create);
doctorRoutes.get('/:id', validate({ params: idParams }), doctors.getById);

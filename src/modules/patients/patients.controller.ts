import type { Request, Response } from 'express';
import type { ListPatientsQuery } from './patients.schema';
import * as patientsService from './patients.service';

const listQuery = (req: Request) => req.query as unknown as ListPatientsQuery;

export async function list(req: Request, res: Response) {
  const data = await patientsService.listPatients(listQuery(req));
  res.json({ success: true, data });
}

export async function getById(req: Request, res: Response) {
  const patient = await patientsService.getPatient(req.params.id as string);
  res.json({ success: true, data: patient });
}

export async function update(req: Request, res: Response) {
  const patient = await patientsService.updatePatient(req.params.id as string, req.body);
  res.json({ success: true, data: patient });
}

export async function remove(req: Request, res: Response) {
  const result = await patientsService.deletePatient(req.params.id as string);
  res.json({ success: true, data: result });
}

// Nested under /doctors/:id/patients — :id is the doctor.
export async function listForDoctor(req: Request, res: Response) {
  const data = await patientsService.listPatients(listQuery(req), req.params.id as string);
  res.json({ success: true, data });
}

export async function createForDoctor(req: Request, res: Response) {
  const patient = await patientsService.createPatient(req.params.id as string, req.body);
  res.status(201).json({ success: true, data: patient });
}

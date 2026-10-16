import type { Request, Response } from 'express';
import type { ListDoctorsQuery } from './doctors.schema';
import * as doctorsService from './doctors.service';

export async function list(req: Request, res: Response) {
  const data = await doctorsService.listDoctors(req.query as unknown as ListDoctorsQuery);
  res.json({ success: true, data });
}

export async function getById(req: Request, res: Response) {
  const doctor = await doctorsService.getDoctor(req.params.id as string);
  res.json({ success: true, data: doctor });
}

export async function create(req: Request, res: Response) {
  const doctor = await doctorsService.createDoctor(req.body);
  res.status(201).json({ success: true, data: doctor });
}

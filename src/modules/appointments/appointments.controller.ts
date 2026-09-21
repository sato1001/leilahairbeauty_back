import { Request, Response, NextFunction } from "express";
import {
  appointmentIdParamSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
} from "./appointments.schema";
import { appointmentsService } from "./appointments.service";

export class AppointmentsController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createAppointmentSchema.parse(req.body);
      const result = await appointmentsService.create(data, req.user!);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = appointmentIdParamSchema.parse(req.params);
      const result = await appointmentsService.getById(id, req.user!);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listAppointmentsQuerySchema.parse(req.query);
      const result = await appointmentsService.list(query, req.user!);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentsController = new AppointmentsController();


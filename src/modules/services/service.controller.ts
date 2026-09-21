import { Request, Response, NextFunction } from "express";
import {
  serviceIdParamSchema,
  createServiceSchema,
  updateServiceSchema,
} from "./service.schema";
import { servicesService } from "./service.service";

export class ServiceController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const services = await servicesService.listPublic();
      res.status(200).json({ services });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = serviceIdParamSchema.parse(req.params);
      const service = await servicesService.getById(id);
      res.status(200).json({ service });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createServiceSchema.parse(req.body);
      const service = await servicesService.create(data);
      res.status(201).json({ service });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = serviceIdParamSchema.parse(req.params);
      const data = updateServiceSchema.parse(req.body);
      const service = await servicesService.update(id, data);
      res.status(200).json({ service });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = serviceIdParamSchema.parse(req.params);
      const service = await servicesService.softDelete(id);
      res.status(200).json({
        message: "Serviço desativado com sucesso",
        service,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const serviceController = new ServiceController();


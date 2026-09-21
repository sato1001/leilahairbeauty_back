import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { NotFoundError } from "../../errors/app.error";
import { CreateServiceInput, UpdateServiceInput } from "./service.schema";
import { ServiceResponse } from "./service.types";

export class ServicesService {
  private formatService(s: {
    id: number;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: Prisma.Decimal | number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ServiceResponse {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      duration_minutes: s.durationMinutes,
      price: Number(s.price),
      active: s.active,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    };
  }

  async listPublic(): Promise<ServiceResponse[]> {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    return services.map(this.formatService);
  }

  async getById(id: number): Promise<ServiceResponse> {
    const service = await prisma.service.findFirst({
      where: { id, active: true },
    });

    if (!service) {
      throw new NotFoundError("Serviço não encontrado");
    }

    return this.formatService(service);
  }

  async create(data: CreateServiceInput): Promise<ServiceResponse> {
    const service = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        durationMinutes: data.duration_minutes,
        price: data.price,
        active: data.active ?? true,
      },
    });

    return this.formatService(service);
  }

  async update(id: number, data: UpdateServiceInput): Promise<ServiceResponse> {
    const existing = await prisma.service.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Serviço não encontrado");
    }

    const updateData: Prisma.ServiceUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.duration_minutes !== undefined) updateData.durationMinutes = data.duration_minutes;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.active !== undefined) updateData.active = data.active;

    const updated = await prisma.service.update({
      where: { id },
      data: updateData,
    });

    return this.formatService(updated);
  }

  async softDelete(id: number): Promise<ServiceResponse> {
    const existing = await prisma.service.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Serviço não encontrado");
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        active: false,
      },
    });

    return this.formatService(updated);
  }
}

export const servicesService = new ServicesService();


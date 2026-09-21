import { AppointmentChannel, AppointmentStatus, ServiceItemStatus } from "@prisma/client";
import prisma from "../../lib/prisma";

export interface CreateAppointmentData {
  clientId: number;
  createdBy: number;
  scheduledAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  channel: AppointmentChannel;
  items: Array<{
    serviceId: number;
    priceCharged: number;
    status: ServiceItemStatus;
  }>;
}

export interface UpdateAppointmentData {
  appointmentId: number;
  scheduledAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  servicesToRemoveIds: number[];
  servicesToAdd: Array<{
    serviceId: number;
    priceCharged: number;
    status: ServiceItemStatus;
  }>;
}

export interface ListAppointmentsFilters {
  clientId?: number;
  status?: AppointmentStatus;
  startDate?: Date;
  endDate?: Date;
  skip: number;
  take: number;
}

export class AppointmentsData {
  async findServicesByIds(ids: number[]) {
    return prisma.service.findMany({
      where: { id: { in: ids } },
    });
  }

  async findUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findConflictingAppointment(
    scheduledAt: Date,
    endsAt: Date,
    excludeAppointmentId?: number
  ) {
    return prisma.appointment.findFirst({
      where: {
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        scheduledAt: { lt: endsAt },
        endsAt: { gt: scheduledAt },
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      },
    });
  }

  async createAppointmentTransaction(data: CreateAppointmentData) {
    return prisma.$transaction(async (tx) => {
      // 1. Criar o agendamento
      const appointment = await tx.appointment.create({
        data: {
          clientId: data.clientId,
          createdBy: data.createdBy,
          scheduledAt: data.scheduledAt,
          endsAt: data.endsAt,
          status: data.status,
          channel: data.channel,
        },
      });

      // 2. Criar os appointment_services
      await Promise.all(
        data.items.map((item) =>
          tx.appointmentService.create({
            data: {
              appointmentId: appointment.id,
              serviceId: item.serviceId,
              priceCharged: item.priceCharged,
              status: item.status,
            },
          })
        )
      );

      // 3. Retornar com os relacionamentos carregados
      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          appointmentServices: {
            include: {
              service: true,
            },
          },
        },
      });
    });
  }

  async updateAppointmentTransaction(data: UpdateAppointmentData) {
    return prisma.$transaction(async (tx) => {
      // 1. Remover serviços que não fazem mais parte da composição
      if (data.servicesToRemoveIds.length > 0) {
        await tx.appointmentService.deleteMany({
          where: {
            appointmentId: data.appointmentId,
            serviceId: { in: data.servicesToRemoveIds },
          },
        });
      }

      // 2. Adicionar novos serviços com snapshot do preço vigente
      if (data.servicesToAdd.length > 0) {
        await Promise.all(
          data.servicesToAdd.map((item) =>
            tx.appointmentService.create({
              data: {
                appointmentId: data.appointmentId,
                serviceId: item.serviceId,
                priceCharged: item.priceCharged,
                status: item.status,
              },
            })
          )
        );
      }

      // 3. Atualizar agendamento (scheduledAt, endsAt, status)
      await tx.appointment.update({
        where: { id: data.appointmentId },
        data: {
          scheduledAt: data.scheduledAt,
          endsAt: data.endsAt,
          status: data.status,
        },
      });

      // 4. Retornar agendamento com dados completos
      return tx.appointment.findUniqueOrThrow({
        where: { id: data.appointmentId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          appointmentServices: {
            include: {
              service: true,
            },
          },
        },
      });
    });
  }

  async cancelAppointmentTransaction(appointmentId: number) {
    return prisma.$transaction(async (tx) => {
      // 1. Atualizar agendamento para CANCELLED
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CANCELLED },
      });

      // 2. Atualizar todos os appointment_services não concluídos para CANCELLED
      await tx.appointmentService.updateMany({
        where: {
          appointmentId,
          status: { not: ServiceItemStatus.COMPLETED },
        },
        data: {
          status: ServiceItemStatus.CANCELLED,
        },
      });

      // 3. Retornar com dados completos
      return tx.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          appointmentServices: {
            include: {
              service: true,
            },
          },
        },
      });
    });
  }

  async confirmAppointmentTransaction(appointmentId: number) {
    return prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CONFIRMED },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          appointmentServices: {
            include: {
              service: true,
            },
          },
        },
      });
    });
  }

  async completeAppointmentTransaction(appointmentId: number) {
    return prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.COMPLETED },
      });

      await tx.appointmentService.updateMany({
        where: {
          appointmentId,
          status: { not: ServiceItemStatus.CANCELLED },
        },
        data: {
          status: ServiceItemStatus.COMPLETED,
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          appointmentServices: {
            include: {
              service: true,
            },
          },
        },
      });
    });
  }

  async findSameWeekAppointmentForClient(
    clientId: number,
    startOfWeek: Date,
    endOfWeek: Date,
    excludeId?: number
  ) {
    return prisma.appointment.findFirst({
      where: {
        clientId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        scheduledAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
        id: excludeId ? { not: excludeId } : undefined,
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  async findAppointmentById(id: number) {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        appointmentServices: {
          include: {
            service: true,
          },
        },
      },
    });
  }

  async listAppointments(filters: ListAppointmentsFilters) {
    const where: {
      clientId?: number;
      status?: AppointmentStatus;
      scheduledAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {};

    if (filters.clientId !== undefined) {
      where.clientId = filters.clientId;
    }

    if (filters.status !== undefined) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.scheduledAt = {};
      if (filters.startDate) where.scheduledAt.gte = filters.startDate;
      if (filters.endDate) where.scheduledAt.lte = filters.endDate;
    }

    const [total, appointments] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { scheduledAt: "asc" },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          appointmentServices: {
            include: {
              service: true,
            },
          },
        },
      }),
    ]);

    return { total, appointments };
  }
}

export const appointmentsData = new AppointmentsData();


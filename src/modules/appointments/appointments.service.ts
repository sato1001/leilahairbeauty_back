import { AppointmentChannel, AppointmentStatus, Prisma, ServiceItemStatus, UserRole } from "@prisma/client";
import { appointmentsData } from "./appointments.data";
import { CreateAppointmentInput, ListAppointmentsQuery } from "./appointments.schema";
import {
  AppointmentDetailResponse,
  CreateAppointmentResponse,
  ListAppointmentsResponse,
} from "./appointments.types";
import { AuthUser } from "../auth/auth.types";
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../errors/app.error";
import { getWeekBoundsInSaoPaulo, parseDateInSaoPaulo } from "../../lib/date";

export class AppointmentsService {
  private formatAppointment(appt: {
    id: number;
    clientId: number;
    createdBy: number;
    scheduledAt: Date;
    endsAt: Date;
    status: AppointmentStatus;
    channel: AppointmentChannel;
    createdAt: Date;
    updatedAt: Date;
    client: {
      id: number;
      name: string;
      email: string;
      phone: string | null;
    };
    appointmentServices: Array<{
      serviceId: number;
      priceCharged: Prisma.Decimal | number;
      status: ServiceItemStatus;
      service: {
        name: string;
        durationMinutes: number;
      };
    }>;
  }): AppointmentDetailResponse {
    const duration = Math.round((appt.endsAt.getTime() - appt.scheduledAt.getTime()) / 60000);
    const total = appt.appointmentServices.reduce(
      (acc, item) => acc + Number(item.priceCharged),
      0
    );

    return {
      id: appt.id,
      client: appt.client,
      client_id: appt.clientId,
      created_by: appt.createdBy,
      scheduled_at: appt.scheduledAt,
      ends_at: appt.endsAt,
      status: appt.status,
      channel: appt.channel,
      duration,
      total: Number(total.toFixed(2)),
      services: appt.appointmentServices.map((item) => ({
        service_id: item.serviceId,
        service_name: item.service.name,
        price_charged: Number(item.priceCharged),
        status: item.status,
      })),
      created_at: appt.createdAt,
      updated_at: appt.updatedAt,
    };
  }

  async create(
    input: CreateAppointmentInput,
    authenticatedUser: AuthUser
  ): Promise<CreateAppointmentResponse> {
    let clientId: number;
    let createdBy: number;
    let channel: AppointmentChannel;
    let status: AppointmentStatus;

    // 1. Regras de autorização e perfil (CLIENT vs ADMIN)
    if (authenticatedUser.role === UserRole.CLIENT) {
      clientId = authenticatedUser.id;
      createdBy = authenticatedUser.id;
      channel = AppointmentChannel.ONLINE;
      status = AppointmentStatus.PENDING;
    } else {
      // ADMIN
      if (!input.client_id) {
        throw new AppError(
          "O campo client_id é obrigatório para agendamentos criados por administradores"
        );
      }

      const client = await appointmentsData.findUserById(input.client_id);
      if (!client || client.role !== UserRole.CLIENT) {
        throw new AppError(
          "Cliente inválido: o agendamento deve ser associado a um usuário com perfil CLIENT"
        );
      }

      clientId = input.client_id;
      createdBy = authenticatedUser.id;
      channel = AppointmentChannel.PHONE;
      status = AppointmentStatus.CONFIRMED;
    }

    // 2. Validação e obtenção dos serviços
    const foundServices = await appointmentsData.findServicesByIds(input.services);
    const foundIds = new Set(foundServices.map((s) => s.id));
    const missing = input.services.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundError(`Serviço(s) não encontrado(s): ${missing.join(", ")}`);
    }

    const inactive = foundServices.filter((s) => !s.active);
    if (inactive.length > 0) {
      throw new UnprocessableEntityError(
        `O serviço "${inactive[0].name}" (ID ${inactive[0].id}) está desativado e não pode ser agendado`
      );
    }

    // 3. Cálculo de duração e ends_at
    const totalDuration = foundServices.reduce((acc, s) => acc + s.durationMinutes, 0);
    const scheduledAt = new Date(input.scheduled_at);
    const endsAt = new Date(scheduledAt.getTime() + totalDuration * 60 * 1000);

    // 4. Verificação de conflito de horário
    const conflict = await appointmentsData.findConflictingAppointment(scheduledAt, endsAt);
    if (conflict) {
      throw new ConflictError("Já existe um agendamento para este horário");
    }

    // 5. Preparar itens de serviços com snapshot de preço
    const serviceMap = new Map(foundServices.map((s) => [s.id, s]));
    const items = input.services.map((serviceId) => {
      const s = serviceMap.get(serviceId)!;
      return {
        serviceId: s.id,
        priceCharged: Number(s.price),
        status: ServiceItemStatus.PENDING,
      };
    });

    // 6. Execução atômica da transação
    const createdAppointment = await appointmentsData.createAppointmentTransaction({
      clientId,
      createdBy,
      scheduledAt,
      endsAt,
      status,
      channel,
      items,
    });

    // 7. Sugestão de mesma semana para o cliente
    const { startOfWeek, endOfWeek } = getWeekBoundsInSaoPaulo(scheduledAt);
    const sameWeekAppt = await appointmentsData.findSameWeekAppointmentForClient(
      clientId,
      startOfWeek,
      endOfWeek,
      createdAppointment.id
    );

    const formatted = this.formatAppointment(createdAppointment);

    if (sameWeekAppt) {
      return {
        appointment: formatted,
        suggestion: {
          suggested_date: sameWeekAppt.scheduledAt,
          reference_appointment_id: sameWeekAppt.id,
        },
      };
    }

    return {
      appointment: formatted,
    };
  }

  async getById(id: number, authenticatedUser: AuthUser): Promise<{ appointment: AppointmentDetailResponse }> {
    const appointment = await appointmentsData.findAppointmentById(id);

    if (!appointment) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    // CLIENT só pode consultar os próprios agendamentos
    if (
      authenticatedUser.role === UserRole.CLIENT &&
      appointment.clientId !== authenticatedUser.id
    ) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    return {
      appointment: this.formatAppointment(appointment),
    };
  }

  async list(
    query: ListAppointmentsQuery,
    authenticatedUser: AuthUser
  ): Promise<ListAppointmentsResponse> {
    const clientId =
      authenticatedUser.role === UserRole.CLIENT
        ? authenticatedUser.id
        : query.client_id;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (query.start_date) {
      startDate = parseDateInSaoPaulo(query.start_date, false);
    }
    if (query.end_date) {
      endDate = parseDateInSaoPaulo(query.end_date, true);
    }

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const { total, appointments } = await appointmentsData.listAppointments({
      clientId,
      status: query.status,
      startDate,
      endDate,
      skip,
      take,
    });

    return {
      appointments: appointments.map(this.formatAppointment),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit) || 1,
      },
    };
  }
}

export const appointmentsService = new AppointmentsService();

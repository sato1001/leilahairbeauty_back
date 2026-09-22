import { AppointmentChannel, AppointmentStatus, Prisma, ServiceItemStatus, UserRole } from "@prisma/client";
import { appointmentsData } from "./appointments.data";
import {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from "./appointments.schema";
import {
  AppointmentDetailResponse,
  AppointmentResponse,
  CreateAppointmentResponse,
  ListAppointmentsResponse,
} from "./appointments.types";
import { AuthUser } from "../auth/auth.types";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../errors/app.error";
import { getWeekBoundsInSaoPaulo, parseDateInSaoPaulo } from "../../lib/date";

export function validateStatusTransition(
  currentStatus: AppointmentStatus,
  targetStatus: AppointmentStatus
): void {
  if (currentStatus === targetStatus) {
    return;
  }

  const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    [AppointmentStatus.PENDING]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
    [AppointmentStatus.CONFIRMED]: [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.PENDING,
    ],
    [AppointmentStatus.COMPLETED]: [],
    [AppointmentStatus.CANCELLED]: [],
  };

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new ConflictError(
      `Transição de status inválida: não é permitido alterar de ${currentStatus} para ${targetStatus}`
    );
  }
}

function checkClient48HoursRule(
  currentScheduledAt: Date,
  action: "alteração" | "cancelamento"
): void {
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const timeDifferenceMs = currentScheduledAt.getTime() - Date.now();

  if (timeDifferenceMs < FORTY_EIGHT_HOURS_MS) {
    throw new ForbiddenError(
      `Para ${action} com menos de 48 horas de antecedência, por favor entre em contato diretamente com o salão.`
    );
  }
}

function formatDateInSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getSaoPauloLocalTime(date: Date): {
  weekday: string;
  hour: number;
  minute: number;
  dateKey: string;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return {
    weekday: values.weekday,
    hour: Number(values.hour),
    minute: Number(values.minute),
    dateKey: `${values.year}-${values.month}-${values.day}`,
  };
}

export function validateBusinessHours(scheduledAt: Date, endsAt: Date): void {
  const salonOpenMinutes = 9 * 60;
  const salonCloseMinutes = 19 * 60;
  const businessHoursMessage =
    "O horário do agendamento está fora do horário de funcionamento do salão. Funcionamento: terça a sábado, das 09:00 às 19:00.";

  const startInSaoPaulo = getSaoPauloLocalTime(scheduledAt);
  const endInSaoPaulo = getSaoPauloLocalTime(endsAt);

  const isClosedDay =
    ["Sun", "Mon"].includes(startInSaoPaulo.weekday) ||
    ["Sun", "Mon"].includes(endInSaoPaulo.weekday) ||
    startInSaoPaulo.dateKey !== endInSaoPaulo.dateKey;

  if (isClosedDay) {
    throw new UnprocessableEntityError(businessHoursMessage);
  }

  const startMinutes = startInSaoPaulo.hour * 60 + startInSaoPaulo.minute;
  const endMinutes = endInSaoPaulo.hour * 60 + endInSaoPaulo.minute;

  if (startMinutes < salonOpenMinutes || endMinutes >= salonCloseMinutes) {
    throw new UnprocessableEntityError(businessHoursMessage);
  }
}

function isValidDateString(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  const [yearText, monthText, dayText] = dateString.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export class AppointmentsService {
  async getWeeklyPerformance(query: { week_start?: string }): Promise<{
    week_start: string;
    week_end: string;
    summary: {
      confirmed: number;
      completed: number;
      cancelled: number;
    };
    revenue: number;
    most_booked_service: {
      service_id: number;
      name: string;
      quantity: number;
    } | null;
  }> {
    let weekStart: Date;

    if (query.week_start) {
      if (!isValidDateString(query.week_start)) {
        throw new UnprocessableEntityError("week_start deve ser uma data válida no formato YYYY-MM-DD");
      }

      weekStart = parseDateInSaoPaulo(query.week_start, false);
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        weekday: "short",
      }).format(weekStart);

      if (weekday !== "Mon") {
        throw new UnprocessableEntityError("week_start deve ser uma segunda-feira válida em America/Sao_Paulo");
      }
    } else {
      const { startOfWeek } = getWeekBoundsInSaoPaulo(new Date());
      weekStart = startOfWeek;
    }

    const nextWeekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const summary = await appointmentsData.getWeeklyPerformanceSummary(weekStart, nextWeekStart);
    const revenue = await appointmentsData.getWeeklyRevenue(weekStart, nextWeekStart);
    const mostBookedService = await appointmentsData.getWeeklyMostBookedService(
      weekStart,
      nextWeekStart
    );

    const weekEndDate = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    return {
      week_start: formatDateInSaoPaulo(weekStart),
      week_end: formatDateInSaoPaulo(weekEndDate),
      summary: {
        confirmed: summary.confirmed,
        completed: summary.completed,
        cancelled: summary.cancelled,
      },
      revenue: Number(revenue.toFixed(2)),
      most_booked_service: mostBookedService,
    };
  }

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

    validateBusinessHours(scheduledAt, endsAt);

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

  async update(
    id: number,
    input: UpdateAppointmentInput,
    authenticatedUser: AuthUser
  ): Promise<AppointmentResponse> {
    const appointment = await appointmentsData.findAppointmentById(id);

    if (!appointment) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    if (
      authenticatedUser.role === UserRole.CLIENT &&
      appointment.clientId !== authenticatedUser.id
    ) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    if (
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.CANCELLED
    ) {
      throw new ConflictError(
        `Não é possível alterar um agendamento com status ${appointment.status}`
      );
    }

    if (authenticatedUser.role === UserRole.CLIENT) {
      checkClient48HoursRule(appointment.scheduledAt, "alteração");
    }

    // 1. Resolver horários e duração
    let totalDuration: number;
    let foundServices: Array<{
      id: number;
      name: string;
      price: Prisma.Decimal | number;
      durationMinutes: number;
      active: boolean;
    }> = [];

    if (input.services !== undefined) {
      foundServices = await appointmentsData.findServicesByIds(input.services);
      const foundIds = new Set(foundServices.map((s) => s.id));
      const missing = input.services.filter((sid) => !foundIds.has(sid));

      if (missing.length > 0) {
        throw new NotFoundError(`Serviço(s) não encontrado(s): ${missing.join(", ")}`);
      }

      const inactive = foundServices.filter((s) => !s.active);
      if (inactive.length > 0) {
        throw new UnprocessableEntityError(
          `O serviço "${inactive[0].name}" (ID ${inactive[0].id}) está desativado e não pode ser agendado`
        );
      }

      totalDuration = foundServices.reduce((acc, s) => acc + s.durationMinutes, 0);
    } else {
      totalDuration = appointment.appointmentServices.reduce(
        (acc, item) => acc + item.service.durationMinutes,
        0
      );
    }

    const newScheduledAt =
      input.scheduled_at !== undefined
        ? new Date(input.scheduled_at)
        : appointment.scheduledAt;

    const newEndsAt = new Date(newScheduledAt.getTime() + totalDuration * 60 * 1000);

    validateBusinessHours(newScheduledAt, newEndsAt);

    // 2. Verificar conflito de horário (ignorando o próprio agendamento)
    const conflict = await appointmentsData.findConflictingAppointment(
      newScheduledAt,
      newEndsAt,
      appointment.id
    );

    if (conflict) {
      throw new ConflictError("Já existe um agendamento para este horário");
    }

    // 3. Preparar itens a adicionar e remover mantendo histórico e snapshots existentes
    let servicesToRemoveIds: number[] = [];
    let servicesToAdd: Array<{
      serviceId: number;
      priceCharged: number;
      status: ServiceItemStatus;
    }> = [];

    if (input.services !== undefined) {
      const currentServiceIds = new Set(
        appointment.appointmentServices.map((item) => item.serviceId)
      );
      const newServiceIds = new Set(input.services);

      servicesToRemoveIds = appointment.appointmentServices
        .filter((item) => !newServiceIds.has(item.serviceId))
        .map((item) => item.serviceId);

      const serviceMap = new Map(foundServices.map((s) => [s.id, s]));
      const servicesToAddIds = input.services.filter((sid) => !currentServiceIds.has(sid));

      servicesToAdd = servicesToAddIds.map((sid) => {
        const s = serviceMap.get(sid)!;
        return {
          serviceId: s.id,
          priceCharged: Number(s.price),
          status: ServiceItemStatus.PENDING,
        };
      });
    }

    // 4. Status após alteração: se CLIENT alterar agendamento CONFIRMED, volta para PENDING
    let newStatus = appointment.status;
    if (authenticatedUser.role === UserRole.CLIENT) {
      if (appointment.status === AppointmentStatus.CONFIRMED) {
        newStatus = AppointmentStatus.PENDING;
      }
    }

    // 5. Executar transação atômica
    const updated = await appointmentsData.updateAppointmentTransaction({
      appointmentId: appointment.id,
      scheduledAt: newScheduledAt,
      endsAt: newEndsAt,
      status: newStatus,
      servicesToRemoveIds,
      servicesToAdd,
    });

    return {
      appointment: this.formatAppointment(updated),
    };
  }

  async cancel(id: number, authenticatedUser: AuthUser): Promise<AppointmentResponse> {
    const appointment = await appointmentsData.findAppointmentById(id);

    if (!appointment) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    if (
      authenticatedUser.role === UserRole.CLIENT &&
      appointment.clientId !== authenticatedUser.id
    ) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    if (
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.CANCELLED
    ) {
      throw new ConflictError(
        `Não é possível cancelar um agendamento com status ${appointment.status}`
      );
    }

    if (authenticatedUser.role === UserRole.CLIENT) {
      checkClient48HoursRule(appointment.scheduledAt, "cancelamento");
    }

    validateStatusTransition(appointment.status, AppointmentStatus.CANCELLED);

    const cancelled = await appointmentsData.cancelAppointmentTransaction(appointment.id);

    return {
      appointment: this.formatAppointment(cancelled),
    };
  }

  async confirm(id: number, authenticatedUser: AuthUser): Promise<AppointmentResponse> {
    if (authenticatedUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Acesso negado: permissão restrita a administradores");
    }

    const appointment = await appointmentsData.findAppointmentById(id);

    if (!appointment) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new ConflictError(
        `Não é possível confirmar um agendamento com status ${appointment.status}`
      );
    }

    validateStatusTransition(appointment.status, AppointmentStatus.CONFIRMED);

    const confirmed = await appointmentsData.confirmAppointmentTransaction(appointment.id);

    return {
      appointment: this.formatAppointment(confirmed),
    };
  }

  async complete(id: number, authenticatedUser: AuthUser): Promise<AppointmentResponse> {
    if (authenticatedUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Acesso negado: permissão restrita a administradores");
    }

    const appointment = await appointmentsData.findAppointmentById(id);

    if (!appointment) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new ConflictError(
        `Não é possível concluir um agendamento com status ${appointment.status}`
      );
    }

    validateStatusTransition(appointment.status, AppointmentStatus.COMPLETED);

    const completed = await appointmentsData.completeAppointmentTransaction(appointment.id);

    return {
      appointment: this.formatAppointment(completed),
    };
  }
}

export const appointmentsService = new AppointmentsService();

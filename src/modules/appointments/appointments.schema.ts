import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

export const appointmentIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "ID deve ser um número inteiro válido")
    .transform(Number),
});

export const createAppointmentSchema = z.object({
  client_id: z.number().int().positive("client_id deve ser um número positivo").optional(),
  scheduled_at: z
    .string()
    .min(1, "scheduled_at é obrigatório")
    .refine((val) => !isNaN(new Date(val).getTime()), {
      message: "Data de agendamento inválida",
    })
    .refine((val) => new Date(val).getTime() > Date.now(), {
      message: "A data do agendamento deve ser no futuro",
    }),
  services: z
    .array(z.number().int().positive("ID do serviço deve ser um número inteiro positivo"))
    .min(1, "O agendamento deve possuir pelo menos um serviço")
    .refine((items) => new Set(items).size === items.length, {
      message: "Serviços duplicados não são permitidos no mesmo agendamento",
    }),
});

export const listAppointmentsQuerySchema = z.object({
  client_id: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : undefined)),
  status: z.nativeEnum(AppointmentStatus).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
});

export const updateAppointmentSchema = z
  .object({
    scheduled_at: z
      .string()
      .min(1, "scheduled_at não pode ser vazio")
      .refine((val) => !isNaN(new Date(val).getTime()), {
        message: "Data de agendamento inválida",
      })
      .refine((val) => new Date(val).getTime() > Date.now(), {
        message: "A data do agendamento deve ser no futuro",
      })
      .optional(),
    services: z
      .array(z.number().int().positive("ID do serviço deve ser um número inteiro positivo"))
      .min(1, "A lista de serviços deve possuir pelo menos um serviço")
      .refine((items) => new Set(items).size === items.length, {
        message: "Serviços duplicados não são permitidos no mesmo agendamento",
      })
      .optional(),
  })
  .refine((data) => data.scheduled_at !== undefined || data.services !== undefined, {
    message: "Informe ao menos um campo para alteração: scheduled_at ou services",
  });

export const weeklyPerformanceQuerySchema = z.object({
  week_start: z.string().optional(),
});

export const createClientSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório"),
    phone: z.string().trim().min(1, "Telefone é obrigatório").optional().nullable(),
    email: z.string().trim().email("Email inválido").optional().nullable(),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").optional(),
  })
  .refine(
    (data) => {
      const hasEmail = Boolean(data.email);
      const hasPassword = Boolean(data.password);
      return !hasEmail && !hasPassword ? true : hasEmail && hasPassword;
    },
    {
      message: "Para criar login, envie email e password juntos",
      path: ["email"],
    }
  );

export const searchClientsQuerySchema = z.object({
  q: z.string().trim().min(1, "q é obrigatório").optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type WeeklyPerformanceQuery = z.infer<typeof weeklyPerformanceQuerySchema>;
export type CreateAdminClientInput = z.infer<typeof createClientSchema>;
export type SearchClientsQuery = z.infer<typeof searchClientsQuerySchema>;

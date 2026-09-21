import { z } from "zod";

export const serviceIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "ID deve ser um número inteiro válido")
    .transform(Number),
});

export const createServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório"),
  description: z.string().trim().optional().nullable(),
  duration_minutes: z
    .number()
    .int("Duração deve ser um número inteiro")
    .positive("Duração deve ser maior que 0"),
  price: z
    .number()
    .min(0, "Preço deve ser maior ou igual a 0"),
  active: z.boolean().optional().default(true),
});

export const updateServiceSchema = z.object({
  name: z.string().trim().min(1, "Nome não pode ser vazio").optional(),
  description: z.string().trim().optional().nullable(),
  duration_minutes: z
    .number()
    .int("Duração deve ser um número inteiro")
    .positive("Duração deve ser maior que 0")
    .optional(),
  price: z
    .number()
    .min(0, "Preço deve ser maior ou igual a 0")
    .optional(),
  active: z.boolean().optional(),
});

export type ServiceIdParam = z.infer<typeof serviceIdParamSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;


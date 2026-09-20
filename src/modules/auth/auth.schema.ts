import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .transform((val) => val.toLowerCase()),
  phone: z.string().trim().optional().nullable(),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(1, "Senha é obrigatória"),
});

export type LoginInput = z.infer<typeof loginSchema>;


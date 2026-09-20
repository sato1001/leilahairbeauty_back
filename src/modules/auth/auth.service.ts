import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import prisma from "../../lib/prisma";
import { generateToken } from "../../lib/jwt";
import { ConflictError, UnauthorizedError } from "../../errors/app.error";
import { RegisterInput, LoginInput } from "./auth.schema";
import { UserResponse, LoginResponse } from "./auth.types";

export class AuthService {
  async register(input: RegisterInput): Promise<UserResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictError("Email já cadastrado");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: normalizedEmail,
        phone: input.phone || null,
        passwordHash,
        role: UserRole.CLIENT,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    return { user };
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    const token = generateToken({
      sub: String(user.id),
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async getMe(userId: number): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError("Usuário não encontrado");
    }

    return { user };
  }
}

export const authService = new AuthService();


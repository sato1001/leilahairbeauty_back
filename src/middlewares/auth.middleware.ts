import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import prisma from "../lib/prisma";
import { UnauthorizedError } from "../errors/app.error";

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next(new UnauthorizedError("Token de autenticação não fornecido"));
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    next(new UnauthorizedError("Formato do cabeçalho Authorization inválido"));
    return;
  }

  const token = parts[1];

  try {
    const payload = verifyToken(token);
    const userId = Number(payload.sub);

    if (isNaN(userId)) {
      next(new UnauthorizedError("Token inválido"));
      return;
    }

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
      next(new UnauthorizedError("Usuário não encontrado"));
      return;
    }

    req.user = user;
    next();
  } catch {
    next(new UnauthorizedError("Token inválido ou expirado"));
  }
}


import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors/app.error";
import { UserRole } from "@prisma/client";

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError("Token de autenticação não fornecido"));
    return;
  }

  if (req.user.role !== UserRole.ADMIN) {
    next(new ForbiddenError("Acesso negado: permissão restrita a administradores"));
    return;
  }

  next();
}


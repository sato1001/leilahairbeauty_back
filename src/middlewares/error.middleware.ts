import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app.error";
import { Prisma } from "@prisma/client";

export function errorMiddleware(
  error: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Dados de entrada inválidos",
      errors: error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        message: "Email já cadastrado",
      });
      return;
    }

    if (
      error.code === "P2004" ||
      error.message?.includes("no_overlapping_active_appointments")
    ) {
      res.status(409).json({
        message: "Já existe um agendamento para este horário",
      });
      return;
    }
  }

  res.status(500).json({
    message: "Erro interno do servidor",
  });
}


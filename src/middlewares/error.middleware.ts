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
  if (process.env.NODE_ENV !== "test") {
    if (error instanceof AppError) {
      console.warn(`\x1b[33m[AppError]\x1b[0m ${error.message} (${error.statusCode})`);
    } else if (error instanceof ZodError) {
      console.warn(`\x1b[33m[ZodValidationError]\x1b[0m ${JSON.stringify(error.issues.map((i) => ({ field: i.path.join("."), message: i.message })))}`);
    } else {
      console.error(`\x1b[31m[ServerError]\x1b[0m`, error);
    }
  }

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


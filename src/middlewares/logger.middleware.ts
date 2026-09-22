import { Request, Response, NextFunction } from "express";

function getMethodColor(method: string): string {
  switch (method) {
    case "GET":
      return "\x1b[32m"; // Green
    case "POST":
      return "\x1b[34m"; // Blue
    case "PUT":
    case "PATCH":
      return "\x1b[33m"; // Yellow
    case "DELETE":
      return "\x1b[31m"; // Red
    default:
      return "\x1b[36m"; // Cyan
  }
}

function getStatusColor(status: number): string {
  if (status >= 500) return "\x1b[31m"; // Red
  if (status >= 400) return "\x1b[33m"; // Yellow
  if (status >= 300) return "\x1b[36m"; // Cyan
  if (status >= 200) return "\x1b[32m"; // Green
  return "\x1b[0m";
}

export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Silence logs during automated test runs
  if (process.env.NODE_ENV === "test") {
    next();
    return;
  }

  const start = Date.now();
  const reset = "\x1b[0m";
  const dim = "\x1b[2m";
  const bold = "\x1b[1m";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    const methodColor = getMethodColor(req.method);
    const statusColor = getStatusColor(res.statusCode);

    const logLine = `${dim}[${timeStr}]${reset} ${methodColor}${bold}${req.method.padEnd(6)}${reset} ${req.originalUrl || req.url} ${statusColor}${bold}${res.statusCode}${reset} ${dim}${duration}ms${reset}`;
    console.log(logLine);
  });

  next();
}

import express, { Application } from "express";
import healthRouter from "./routes/health";
import authRouter from "./modules/auth/auth.routes";
import serviceRouter from "./modules/services/service.routes";
import appointmentsRouter from "./modules/appointments/appointments.routes";
import { setupSwagger } from "./docs/swagger";
import { errorMiddleware } from "./middlewares/error.middleware";

const app: Application = express();
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

setupSwagger(app);

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Leila Hair & Beauty API",
    health: "/health",
    docs: "/api-docs",
  });
});

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/services", serviceRouter);
app.use("/appointments", appointmentsRouter);

app.use(errorMiddleware);

export default app;

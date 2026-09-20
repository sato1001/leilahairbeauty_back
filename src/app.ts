import express, { Application } from "express";
import healthRouter from "./routes/health";
import authRouter from "./modules/auth/auth.routes";
import { setupSwagger } from "./docs/swagger";
import { errorMiddleware } from "./middlewares/error.middleware";

const app: Application = express();

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

app.use(errorMiddleware);

export default app;

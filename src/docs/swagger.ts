import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application } from "express";

const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Leila Hair & Beauty API",
      version: "1.0.0",
      description: "Documentação interativa da API do Desafio Técnico Leila Hair & Beauty",
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Servidor Local",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/app.ts"],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);

export function setupSwagger(app: Application): void {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}


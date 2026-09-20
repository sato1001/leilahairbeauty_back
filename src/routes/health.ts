import { Router, Request, Response } from "express";

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Retorna o status de saúde da aplicação
 *     description: Endpoint para verificar se a API está online e respondendo adequadamente.
 *     responses:
 *       200:
 *         description: API em pleno funcionamento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                   example: 12.34
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-09-20T17:36:57.368Z
 */
router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;


import { Router } from "express";
import { appointmentsController } from "./appointments.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const appointmentsRouter = Router();

/**
 * @openapi
 * /appointments:
 *   post:
 *     summary: Cria um novo agendamento
 *     description: Permite que CLIENT crie agendamento para si mesmo (ONLINE, PENDING) ou que ADMIN crie para um CLIENT (PHONE, CONFIRMED).
 *     tags:
 *       - Agendamentos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scheduled_at
 *               - services
 *             properties:
 *               client_id:
 *                 type: integer
 *                 description: Obrigatório apenas para ADMIN. CLIENT não deve enviar este campo.
 *                 example: 2
 *               scheduled_at:
 *                 type: string
 *                 format: date-time
 *                 description: Data/hora futura no formato ISO 8601
 *                 example: "2026-09-22T14:00:00Z"
 *               services:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 minItems: 1
 *                 description: Lista de IDs dos serviços a serem realizados (sem duplicatas)
 *                 example: [1, 2]
 *     responses:
 *       201:
 *         description: Agendamento criado com sucesso
 *       400:
 *         description: Dados de entrada inválidos ou scheduled_at no passado
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Serviço não encontrado
 *       409:
 *         description: Conflito de horário com outro agendamento ativo
 *       422:
 *         description: Serviço selecionado está desativado
 *   get:
 *     summary: Lista agendamentos com paginação e filtros
 *     description: CLIENT visualiza apenas seus próprios agendamentos; ADMIN visualiza todos os agendamentos.
 *     tags:
 *       - Agendamentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, COMPLETED, CANCELLED]
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           example: "2026-09-22"
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           example: "2026-09-28"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista paginada de agendamentos
 *       401:
 *         description: Não autenticado
 */
appointmentsRouter.post("/", authMiddleware, (req, res, next) => {
  appointmentsController.create(req, res, next);
});

appointmentsRouter.get("/", authMiddleware, (req, res, next) => {
  appointmentsController.list(req, res, next);
});

/**
 * @openapi
 * /appointments/{id}:
 *   get:
 *     summary: Consulta agendamento por ID
 *     description: CLIENT só pode consultar seus próprios agendamentos (retorna 404 se pertencer a outro); ADMIN pode consultar qualquer agendamento.
 *     tags:
 *       - Agendamentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalhes do agendamento
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Agendamento não encontrado
 */
appointmentsRouter.get("/:id", authMiddleware, (req, res, next) => {
  appointmentsController.getById(req, res, next);
});

export default appointmentsRouter;


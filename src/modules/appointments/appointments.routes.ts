import { Router } from "express";
import { appointmentsController } from "./appointments.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireAdmin } from "../../middlewares/role.middleware";

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
 * /appointments/weekly-performance:
 *   get:
 *     summary: Retorna o desempenho semanal de agendamentos
 *     description: Endpoint exclusivo para ADMIN. Calcula contagem por status, faturamento total de agendamentos concluídos e o serviço mais agendado durante a semana. Se week_start não for informado, usa a semana atual em America/Sao_Paulo; deve ser uma segunda-feira válida.
 *     tags:
 *       - Agendamentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: week_start
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-21"
 *     responses:
 *       200:
 *         description: Dados agregados da semana
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a administradores
 *       422:
 *         description: week_start inválida ou não é segunda-feira
 */
appointmentsRouter.get(
  "/weekly-performance",
  authMiddleware,
  requireAdmin,
  (req, res, next) => {
    appointmentsController.weeklyPerformance(req, res, next);
  }
);

/**
 * @openapi
 * /appointments/clients/search:
 *   get:
 *     summary: Busca clientes por nome ou telefone
 *     description: Endpoint exclusivo para ADMIN. Permite localizar clientes cadastrados pelo administrador usando texto livre em nome ou telefone.
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *           example: "99999"
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista de clientes encontrados
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a administradores
 */
appointmentsRouter.get("/clients/search", authMiddleware, requireAdmin, (req, res, next) => {
  appointmentsController.searchClients(req, res, next);
});

/**
 * @openapi
 * /appointments/clients:
 *   get:
 *     summary: Lista clientes cadastrados pelo admin
 *     description: Endpoint exclusivo para ADMIN. Retorna clientes paginados para uso em seleção de cliente no agendamento telefônico.
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *           example: "Maria"
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista de clientes
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a administradores
 */
appointmentsRouter.get("/clients", authMiddleware, requireAdmin, (req, res, next) => {
  appointmentsController.listClients(req, res, next);
});

/**
 * @openapi
 * /appointments/clients:
 *   post:
 *     summary: Cria cliente sem conta de acesso
 *     description: Endpoint exclusivo para ADMIN. Cria um cliente cadastrado sem email/senha, usado para agendamento por telefone.
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Cliente sem conta"
 *               phone:
 *                 type: string
 *                 example: "(18) 99999-9999"
 *               email:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 nullable: true
 *                 example: null
 *     responses:
 *       201:
 *         description: Cliente criado com sucesso
 *       400:
 *         description: Dados inválidos ou email/senha incompletos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a administradores
 *       409:
 *         description: Cliente com telefone ou email duplicado
 */
appointmentsRouter.post("/clients", authMiddleware, requireAdmin, (req, res, next) => {
  appointmentsController.createClient(req, res, next);
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

/**
 * @openapi
 * /appointments/{id}:
 *   patch:
 *     summary: Altera horário e/ou serviços de um agendamento
 *     description: Permite alterar scheduled_at, lista de serviços ou ambos. CLIENT só altera os próprios agendamentos com antecedência mínima de 48h (retorna 403 se < 48h; se CONFIRMED, retorna para status PENDING). ADMIN altera qualquer agendamento sem restrição de prazo (mantém o status atual).
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduled_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-10-15T15:00:00Z"
 *               services:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 minItems: 1
 *                 example: [1, 2]
 *     responses:
 *       200:
 *         description: Agendamento alterado com sucesso
 *       400:
 *         description: Dados de entrada inválidos ou nenhum campo informado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Alteração não permitida com menos de 48 horas de antecedência
 *       404:
 *         description: Agendamento ou serviço não encontrado
 *       409:
 *         description: Conflito de horário ou agendamento em estado final (COMPLETED ou CANCELLED)
 *       422:
 *         description: Serviço desativado
 *   delete:
 *     summary: Cancelamento lógico de um agendamento
 *     description: Altera o status do agendamento para CANCELLED e de seus serviços vinculados pendentes para CANCELLED sem remover o registro fisicamente. CLIENT requer no mínimo 48h de antecedência (retorna 403 se < 48h); ADMIN cancela sem restrição de prazo.
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
 *         description: Agendamento cancelado com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Cancelamento não permitido com menos de 48 horas de antecedência
 *       404:
 *         description: Agendamento não encontrado
 *       409:
 *         description: Agendamento já concluído ou cancelado
 */
appointmentsRouter.patch("/:id", authMiddleware, (req, res, next) => {
  appointmentsController.update(req, res, next);
});

appointmentsRouter.delete("/:id", authMiddleware, (req, res, next) => {
  appointmentsController.cancel(req, res, next);
});

/**
 * @openapi
 * /appointments/{id}/confirm:
 *   patch:
 *     summary: Confirmação administrativa de agendamento
 *     description: Ação explícita restrita a administradores. Transição permitida exclusivamente de PENDING para CONFIRMED.
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
 *         description: Agendamento confirmado com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a administradores
 *       404:
 *         description: Agendamento não encontrado
 *       409:
 *         description: Transição de status inválida (status atual não é PENDING)
 */
appointmentsRouter.patch("/:id/confirm", authMiddleware, requireAdmin, (req, res, next) => {
  appointmentsController.confirm(req, res, next);
});

/**
 * @openapi
 * /appointments/{id}/complete:
 *   patch:
 *     summary: Conclusão administrativa de agendamento
 *     description: Ação explícita restrita a administradores. Transição permitida exclusivamente de CONFIRMED para COMPLETED.
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
 *         description: Agendamento concluído com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a administradores
 *       404:
 *         description: Agendamento não encontrado
 *       409:
 *         description: Transição de status inválida (status atual não é CONFIRMED)
 */
appointmentsRouter.patch("/:id/complete", authMiddleware, requireAdmin, (req, res, next) => {
  appointmentsController.complete(req, res, next);
});

export default appointmentsRouter;


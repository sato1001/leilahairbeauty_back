import { Router } from "express";
import { serviceController } from "./service.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireAdmin } from "../../middlewares/role.middleware";

const serviceRouter = Router();

/**
 * @openapi
 * /services:
 *   get:
 *     summary: Lista todos os serviços ativos (catálogo público)
 *     tags:
 *       - Serviços
 *     responses:
 *       200:
 *         description: Lista de serviços ativos retornada com sucesso
 *   post:
 *     summary: Cria um novo serviço (Apenas Administrador)
 *     tags:
 *       - Serviços
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
 *               - duration_minutes
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 example: Corte Feminino
 *               description:
 *                 type: string
 *                 example: Corte personalizado com lavagem
 *               duration_minutes:
 *                 type: integer
 *                 example: 45
 *               price:
 *                 type: number
 *                 example: 80.00
 *               active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Serviço criado com sucesso
 *       400:
 *         description: Dados de entrada inválidos
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Permissão negada
 */
serviceRouter.get("/", (req, res, next) => {
  serviceController.list(req, res, next);
});

serviceRouter.post("/", authMiddleware, requireAdmin, (req, res, next) => {
  serviceController.create(req, res, next);
});

/**
 * @openapi
 * /services/{id}:
 *   get:
 *     summary: Retorna detalhes de um serviço ativo por ID
 *     tags:
 *       - Serviços
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dados do serviço ativo
 *       404:
 *         description: Serviço não encontrado ou inativo
 *   patch:
 *     summary: Atualiza dados de um serviço existente (Apenas Administrador)
 *     tags:
 *       - Serviços
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               duration_minutes:
 *                 type: integer
 *               price:
 *                 type: number
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Serviço atualizado com sucesso
 *       404:
 *         description: Serviço não encontrado
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Permissão negada
 *   delete:
 *     summary: Realiza soft delete (exclusão lógica) de um serviço (Apenas Administrador)
 *     tags:
 *       - Serviços
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
 *         description: Serviço desativado com sucesso (active = false)
 *       404:
 *         description: Serviço não encontrado
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Permissão negada
 */
serviceRouter.get("/:id", (req, res, next) => {
  serviceController.getById(req, res, next);
});

serviceRouter.patch("/:id", authMiddleware, requireAdmin, (req, res, next) => {
  serviceController.update(req, res, next);
});

serviceRouter.delete("/:id", authMiddleware, requireAdmin, (req, res, next) => {
  serviceController.delete(req, res, next);
});

export default serviceRouter;


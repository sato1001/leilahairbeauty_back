import { Router } from "express";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const authRouter = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Registro de novo cliente
 *     tags:
 *       - Autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: João da Silva
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@email.com
 *               phone:
 *                 type: string
 *                 example: "18999999999"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: Senha123
 *     responses:
 *       201:
 *         description: Usuário registrado com sucesso
 *       400:
 *         description: Dados de entrada inválidos
 *       409:
 *         description: Email já cadastrado
 */
authRouter.post("/register", (req, res, next) => {
  authController.register(req, res, next);
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login de usuário
 *     tags:
 *       - Autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@email.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Senha123
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Credenciais inválidas
 */
authRouter.post("/login", (req, res, next) => {
  authController.login(req, res, next);
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Dados do usuário autenticado
 *     tags:
 *       - Autenticação
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados públicos do usuário autenticado
 *       401:
 *         description: Não autorizado ou token inválido/expirado
 */
authRouter.get("/me", authMiddleware, (req, res, next) => {
  authController.me(req, res, next);
});

export default authRouter;


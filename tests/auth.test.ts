import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import prisma from "../src/lib/prisma";

describe("Feature: Autenticação", () => {
  const timestamp = Date.now();
  const testUserEmail = `joao_${timestamp}@email.com`;
  const duplicateUserEmail = `duplicado_${timestamp}@email.com`;
  const adminSeedEmail = "admin@leilahairbeauty.com";
  const adminSeedPassword = "Admin@123456";

  let createdUserId: number;
  let validToken: string;

  before(async () => {
    // Garantir que o usuário duplicado exista para o teste
    await prisma.user.upsert({
      where: { email: duplicateUserEmail },
      update: {},
      create: {
        name: "Usuário Duplicado",
        email: duplicateUserEmail,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
        role: "CLIENT",
      },
    });
  });

  after(async () => {
    // Limpeza de usuários criados nos testes
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            testUserEmail,
            duplicateUserEmail,
            `outro_${timestamp}@email.com`,
            `role_test_${timestamp}@email.com`,
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe("1. Register (POST /auth/register)", () => {
    it("deve realizar registro válido com role CLIENT e sem expor password_hash", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "João da Silva",
          email: testUserEmail,
          phone: "18999999999",
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 201);
      assert.ok(res.body.user);
      assert.strictEqual(typeof res.body.user.id, "number");
      assert.strictEqual(res.body.user.name, "João da Silva");
      assert.strictEqual(res.body.user.email, testUserEmail);
      assert.strictEqual(res.body.user.phone, "18999999999");
      assert.strictEqual(res.body.user.role, "CLIENT");
      assert.strictEqual(res.body.user.password_hash, undefined);
      assert.strictEqual(res.body.user.passwordHash, undefined);

      createdUserId = res.body.user.id;
    });

    it("deve verificar que a senha foi armazenada como hash no banco", async () => {
      const userInDb = await prisma.user.findUnique({
        where: { id: createdUserId },
      });

      assert.ok(userInDb);
      assert.notStrictEqual(userInDb.passwordHash, "SenhaSegura123");
      assert.ok(userInDb.passwordHash.startsWith("$2"));
      assert.strictEqual(userInDb.passwordHash.length, 60);
    });

    it("deve falhar quando nome estiver ausente", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: `semnome_${timestamp}@email.com`,
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve falhar quando email estiver ausente", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Sem Email",
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve falhar quando email for inválido", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Email Invalido",
          email: "email-invalido-sem-arroba",
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve falhar quando senha tiver menos de 8 caracteres", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Senha Curta",
          email: `curta_${timestamp}@email.com`,
          password: "curta",
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve retornar 409 Conflict quando email já estiver cadastrado", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Tentativa Duplicada",
          email: duplicateUserEmail,
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.message, "Email já cadastrado");
    });

    it("não deve permitir criar usuário ADMIN pelo endpoint público (deve forçar CLIENT)", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Tentativa Admin",
          email: `role_test_${timestamp}@email.com`,
          password: "SenhaSegura123",
          role: "ADMIN",
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.user.role, "CLIENT");

      const inDb = await prisma.user.findUnique({
        where: { id: res.body.user.id },
      });
      assert.strictEqual(inDb?.role, "CLIENT");
    });
  });

  describe("2. Login (POST /auth/login)", () => {
    it("deve autenticar com sucesso e retornar token JWT e dados do usuário", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testUserEmail,
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.ok(res.body.user);
      assert.strictEqual(res.body.user.id, createdUserId);
      assert.strictEqual(res.body.user.email, testUserEmail);
      assert.strictEqual(res.body.user.password_hash, undefined);

      validToken = res.body.token;

      // Validar estrutura e claims do payload JWT
      const decoded = jwt.decode(validToken) as { sub: string; role: string };
      assert.strictEqual(decoded.sub, String(createdUserId));
      assert.strictEqual(decoded.role, "CLIENT");
    });

    it("deve normalizar email em maiúsculas durante o login", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testUserEmail.toUpperCase(),
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.email, testUserEmail);
    });

    it("deve permitir que o usuário ADMIN do seed faça login", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: adminSeedEmail,
          password: adminSeedPassword,
        });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.role, "ADMIN");

      const decoded = jwt.decode(res.body.token) as { sub: string; role: string };
      assert.strictEqual(decoded.role, "ADMIN");
    });

    it("deve retornar 401 com mensagem genérica quando email não existir", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: `naoexiste_${timestamp}@email.com`,
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.message, "Credenciais inválidas");
    });

    it("deve retornar 401 com mensagem genérica quando senha estiver incorreta", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testUserEmail,
          password: "SenhaTotalmenteErrada",
        });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.message, "Credenciais inválidas");
    });

    it("deve retornar 400 quando email estiver ausente no login", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          password: "SenhaSegura123",
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve retornar 400 quando senha estiver ausente no login", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testUserEmail,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });
  });

  describe("3. Middleware de Autenticação", () => {
    it("deve retornar 401 quando Authorization header não for enviado", async () => {
      const res = await request(app).get("/auth/me");

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.message, "Token de autenticação não fornecido");
    });

    it("deve retornar 401 quando Authorization header for malformado (sem prefixo Bearer)", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", validToken);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.message, "Formato do cabeçalho Authorization inválido");
    });

    it("deve retornar 401 quando token for inválido", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer token_invalido_123");

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.message, "Token inválido ou expirado");
    });

    it("deve retornar 401 quando token estiver expirado", async () => {
      const secret = process.env.JWT_SECRET || "supersecretjwtkey_leilahairbeauty_2026";
      const expiredToken = jwt.sign(
        { sub: String(createdUserId), role: "CLIENT" },
        secret,
        { expiresIn: "0s" }
      );

      // Pequeno delay para garantir expiração
      await new Promise((resolve) => setTimeout(resolve, 50));

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.message, "Token inválido ou expirado");
    });

    it("deve retornar 401 quando o usuário do token não existir mais no banco", async () => {
      const secret = process.env.JWT_SECRET || "supersecretjwtkey_leilahairbeauty_2026";
      const tokenUsuarioInexistente = jwt.sign(
        { sub: "99999999", role: "CLIENT" },
        secret,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${tokenUsuarioInexistente}`);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.message, "Usuário não encontrado");
    });

    it("deve passar com sucesso quando token for válido", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.user);
    });
  });

  describe("4. Endpoint /auth/me (GET /auth/me)", () => {
    it("deve retornar dados públicos do usuário autenticado", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.user);
      assert.strictEqual(res.body.user.id, createdUserId);
      assert.strictEqual(res.body.user.name, "João da Silva");
      assert.strictEqual(res.body.user.email, testUserEmail);
      assert.strictEqual(res.body.user.phone, "18999999999");
      assert.strictEqual(res.body.user.role, "CLIENT");
      assert.strictEqual(res.body.user.password_hash, undefined);
      assert.strictEqual(res.body.user.passwordHash, undefined);
    });

    it("deve bloquear acesso sem token com HTTP 401", async () => {
      const res = await request(app).get("/auth/me");
      assert.strictEqual(res.status, 401);
    });

    it("deve bloquear acesso com token inválido com HTTP 401", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid.jwt.token");
      assert.strictEqual(res.status, 401);
    });
  });
});


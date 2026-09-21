import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";
import { generateToken } from "../src/lib/jwt";
import { UserRole, AppointmentChannel, AppointmentStatus } from "@prisma/client";

describe("Feature: Services (com Soft Delete)", () => {
  let adminUser: { id: number; email: string };
  let clientUser: { id: number; email: string };
  let adminToken: string;
  let clientToken: string;

  let testServiceId: number;
  let linkedServiceId: number;
  let testAppointmentId: number;
  let testAppointmentServiceId: number;

  before(async () => {
    // 1. Criar ou buscar Admin para os testes
    const admin = await prisma.user.upsert({
      where: { email: "admin_services_test@leilahairbeauty.com" },
      update: {},
      create: {
        name: "Admin Services Test",
        email: "admin_services_test@leilahairbeauty.com",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
        role: UserRole.ADMIN,
      },
    });
    adminUser = { id: admin.id, email: admin.email };
    adminToken = generateToken({ sub: String(admin.id), role: "ADMIN" });

    // 2. Criar ou buscar Client para os testes
    const client = await prisma.user.upsert({
      where: { email: "client_services_test@leilahairbeauty.com" },
      update: {},
      create: {
        name: "Client Services Test",
        email: "client_services_test@leilahairbeauty.com",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
        role: UserRole.CLIENT,
      },
    });
    clientUser = { id: client.id, email: client.email };
    clientToken = generateToken({ sub: String(client.id), role: "CLIENT" });

    // 3. Criar serviço de teste que será desativado
    const service1 = await prisma.service.create({
      data: {
        name: "Corte Teste Soft Delete",
        description: "Descrição de teste",
        durationMinutes: 30,
        price: 50.0,
        active: true,
      },
    });
    testServiceId = service1.id;

    // 4. Criar serviço com agendamento vinculado para testar integridade histórica
    const service2 = await prisma.service.create({
      data: {
        name: "Serviço com Histórico de Agendamento",
        description: "Serviço vinculado a appointment_services",
        durationMinutes: 60,
        price: 150.0,
        active: true,
      },
    });
    linkedServiceId = service2.id;

    // 5. Criar agendamento e item em appointment_services
    const appointment = await prisma.appointment.create({
      data: {
        clientId: clientUser.id,
        createdBy: adminUser.id,
        scheduledAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 86400000 + 3600000),
        status: AppointmentStatus.CONFIRMED,
        channel: AppointmentChannel.ONLINE,
      },
    });
    testAppointmentId = appointment.id;

    const apptService = await prisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: linkedServiceId,
        priceCharged: 150.0,
      },
    });
    testAppointmentServiceId = apptService.id;
  });

  after(async () => {
    // Limpeza na ordem correta de integridade referencial
    if (testAppointmentId) {
      await prisma.appointmentService.deleteMany({
        where: { appointmentId: testAppointmentId },
      });
      await prisma.appointment.deleteMany({
        where: { id: testAppointmentId },
      });
    }

    await prisma.service.deleteMany({
      where: {
        id: { in: [testServiceId, linkedServiceId] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUser.id, clientUser.id] },
      },
    });

    await prisma.$disconnect();
  });

  describe("GET /services (Catálogo público)", () => {
    it("deve listar apenas serviços ativos", async () => {
      const res = await request(app).get("/services");

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.services));
      assert.ok(res.body.services.length > 0);

      // Todos os itens retornados devem ser active === true
      for (const s of res.body.services) {
        assert.strictEqual(s.active, true);
      }
    });
  });

  describe("GET /services/:id", () => {
    it("deve retornar detalhes de um serviço ativo", async () => {
      const res = await request(app).get(`/services/${testServiceId}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.service);
      assert.strictEqual(res.body.service.id, testServiceId);
      assert.strictEqual(res.body.service.active, true);
    });

    it("deve retornar 404 para serviço inexistente", async () => {
      const res = await request(app).get("/services/999999");
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Serviço não encontrado");
    });

    it("deve retornar 400 para ID com formato inválido", async () => {
      const res = await request(app).get("/services/invalido");
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });
  });

  describe("POST /services", () => {
    let createdId: number;

    it("deve permitir que o ADMIN crie um novo serviço", async () => {
      const res = await request(app)
        .post("/services")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Design de Sobrancelhas",
          description: "Mapeamento e alinhamento facial",
          duration_minutes: 30,
          price: 45.0,
        });

      assert.strictEqual(res.status, 201);
      assert.ok(res.body.service);
      assert.strictEqual(res.body.service.name, "Design de Sobrancelhas");
      assert.strictEqual(res.body.service.active, true);
      createdId = res.body.service.id;
    });

    it("deve rejeitar criação por usuário CLIENT com HTTP 403", async () => {
      const res = await request(app)
        .post("/services")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({
          name: "Tentativa Invalida",
          duration_minutes: 30,
          price: 50.0,
        });

      assert.strictEqual(res.status, 403);
    });

    it("deve rejeitar criação sem token de autenticação com HTTP 401", async () => {
      const res = await request(app)
        .post("/services")
        .send({
          name: "Tentativa Sem Token",
          duration_minutes: 30,
          price: 50.0,
        });

      assert.strictEqual(res.status, 401);
    });

    after(async () => {
      if (createdId) {
        await prisma.service.deleteMany({ where: { id: createdId } });
      }
    });
  });

  describe("PATCH /services/:id", () => {
    it("deve permitir que o ADMIN atualize dados de um serviço", async () => {
      const res = await request(app)
        .patch(`/services/${testServiceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          price: 55.0,
          description: "Descrição atualizada via PATCH",
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.service.price, 55.0);
      assert.strictEqual(res.body.service.description, "Descrição atualizada via PATCH");
    });

    it("deve rejeitar atualização por usuário CLIENT com HTTP 403", async () => {
      const res = await request(app)
        .patch(`/services/${testServiceId}`)
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ price: 90.0 });

      assert.strictEqual(res.status, 403);
    });
  });

  describe("DELETE /services/:id (Soft Delete)", () => {
    it("deve rejeitar exclusão sem autenticação com HTTP 401", async () => {
      const res = await request(app).delete(`/services/${testServiceId}`);
      assert.strictEqual(res.status, 401);
    });

    it("deve rejeitar exclusão por usuário CLIENT com HTTP 403", async () => {
      const res = await request(app)
        .delete(`/services/${testServiceId}`)
        .set("Authorization", `Bearer ${clientToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.message, "Acesso negado: permissão restrita a administradores");
    });

    it("deve retornar 404 para exclusão de serviço inexistente", async () => {
      const res = await request(app)
        .delete("/services/999999")
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Serviço não encontrado");
    });

    it("deve realizar soft delete com sucesso para serviço existente", async () => {
      const beforeDelete = await prisma.service.findUnique({
        where: { id: testServiceId },
      });
      assert.ok(beforeDelete);
      assert.strictEqual(beforeDelete.active, true);

      // Pequeno delay para garantir diferença no updated_at
      await new Promise((resolve) => setTimeout(resolve, 50));

      const res = await request(app)
        .delete(`/services/${testServiceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.message, "Serviço desativado com sucesso");
      assert.strictEqual(res.body.service.active, false);

      // 1. O serviço continua existindo fisicamente no banco
      const afterDelete = await prisma.service.findUnique({
        where: { id: testServiceId },
      });
      assert.ok(afterDelete);
      assert.strictEqual(afterDelete.id, testServiceId);

      // 2. active passa de true para false
      assert.strictEqual(afterDelete.active, false);

      // 3. updated_at é atualizado
      assert.ok(afterDelete.updatedAt.getTime() > beforeDelete.updatedAt.getTime());
    });

    it("não deve listar o serviço desativado no GET /services público", async () => {
      const res = await request(app).get("/services");

      assert.strictEqual(res.status, 200);
      const found = res.body.services.find((s: { id: number }) => s.id === testServiceId);
      assert.strictEqual(found, undefined);
    });

    it("deve retornar 404 ao buscar o serviço desativado por ID no catálogo público", async () => {
      const res = await request(app).get(`/services/${testServiceId}`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Serviço não encontrado");
    });

    it("deve manter intactas as referências existentes em appointment_services após o soft delete", async () => {
      // Executa o soft delete no serviço que possui agendamento vinculado
      const res = await request(app)
        .delete(`/services/${linkedServiceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.service.active, false);

      // O serviço continua existindo fisicamente no banco com active = false
      const serviceInDb = await prisma.service.findUnique({
        where: { id: linkedServiceId },
      });
      assert.ok(serviceInDb);
      assert.strictEqual(serviceInDb.active, false);

      // A relação em appointment_services continua 100% preservada
      const apptServiceInDb = await prisma.appointmentService.findUnique({
        where: { id: testAppointmentServiceId },
      });

      assert.ok(apptServiceInDb);
      assert.strictEqual(apptServiceInDb.appointmentId, testAppointmentId);
      assert.strictEqual(apptServiceInDb.serviceId, linkedServiceId);
      assert.strictEqual(Number(apptServiceInDb.priceCharged), 150.0);

      // O agendamento em si também permanece intacto
      const apptInDb = await prisma.appointment.findUnique({
        where: { id: testAppointmentId },
      });
      assert.ok(apptInDb);
      assert.strictEqual(apptInDb.id, testAppointmentId);
    });
  });
});


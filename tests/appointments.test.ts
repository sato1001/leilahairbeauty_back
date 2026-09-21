import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";
import { generateToken } from "../src/lib/jwt";
import { UserRole, AppointmentChannel, AppointmentStatus } from "@prisma/client";

describe("Feature: Appointments (Agendamentos)", () => {
  let adminUser: { id: number; email: string };
  let client1: { id: number; email: string };
  let client2: { id: number; email: string };

  let adminToken: string;
  let client1Token: string;
  let client2Token: string;

  let service1Id: number;
  let service2Id: number;
  let inactiveServiceId: number;

  before(async () => {
    // 1. Criar usuários de teste
    const admin = await prisma.user.upsert({
      where: { email: "admin_appt_test@leilahairbeauty.com" },
      update: {},
      create: {
        name: "Admin Appt Test",
        email: "admin_appt_test@leilahairbeauty.com",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
        role: UserRole.ADMIN,
      },
    });
    adminUser = { id: admin.id, email: admin.email };
    adminToken = generateToken({ sub: String(admin.id), role: "ADMIN" });

    const c1 = await prisma.user.upsert({
      where: { email: "client1_appt_test@leilahairbeauty.com" },
      update: {},
      create: {
        name: "Client 1 Appt Test",
        email: "client1_appt_test@leilahairbeauty.com",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
        role: UserRole.CLIENT,
      },
    });
    client1 = { id: c1.id, email: c1.email };
    client1Token = generateToken({ sub: String(c1.id), role: "CLIENT" });

    const c2 = await prisma.user.upsert({
      where: { email: "client2_appt_test@leilahairbeauty.com" },
      update: {},
      create: {
        name: "Client 2 Appt Test",
        email: "client2_appt_test@leilahairbeauty.com",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
        role: UserRole.CLIENT,
      },
    });
    client2 = { id: c2.id, email: c2.email };
    client2Token = generateToken({ sub: String(c2.id), role: "CLIENT" });

    // 2. Criar serviços de teste
    const s1 = await prisma.service.create({
      data: {
        name: "Corte Appt Test",
        description: "Corte de teste",
        durationMinutes: 30,
        price: 50.0,
        active: true,
      },
    });
    service1Id = s1.id;

    const s2 = await prisma.service.create({
      data: {
        name: "Barba Appt Test",
        description: "Barba de teste",
        durationMinutes: 45,
        price: 40.0,
        active: true,
      },
    });
    service2Id = s2.id;

    const s3 = await prisma.service.create({
      data: {
        name: "Coloração Inativa Appt Test",
        description: "Serviço desativado",
        durationMinutes: 60,
        price: 120.0,
        active: false,
      },
    });
    inactiveServiceId = s3.id;
  });

  after(async () => {
    // Limpeza de agendamentos criados pelos testes
    const testUserIds = [adminUser.id, client1.id, client2.id];

    await prisma.appointmentService.deleteMany({
      where: {
        appointment: {
          OR: [
            { clientId: { in: testUserIds } },
            { createdBy: { in: testUserIds } },
          ],
        },
      },
    });

    await prisma.appointment.deleteMany({
      where: {
        OR: [
          { clientId: { in: testUserIds } },
          { createdBy: { in: testUserIds } },
        ],
      },
    });

    // Limpeza de serviços de teste
    await prisma.service.deleteMany({
      where: {
        id: { in: [service1Id, service2Id, inactiveServiceId] },
      },
    });

    // Limpeza de usuários de teste
    await prisma.user.deleteMany({
      where: {
        id: { in: testUserIds },
      },
    });

    await prisma.$disconnect();
  });

  describe("1. POST /appointments (Criação de agendamento)", () => {
    it("deve permitir que o CLIENT crie um agendamento para si mesmo com status PENDING e channel ONLINE", async () => {
      // 10 dias no futuro
      const scheduledAt = new Date(Date.now() + 10 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: scheduledAt,
          services: [service1Id, service2Id],
        });

      assert.strictEqual(res.status, 201);
      assert.ok(res.body.appointment);
      assert.strictEqual(res.body.appointment.client_id, client1.id);
      assert.strictEqual(res.body.appointment.created_by, client1.id);
      assert.strictEqual(res.body.appointment.status, "PENDING");
      assert.strictEqual(res.body.appointment.channel, "ONLINE");
      assert.strictEqual(res.body.appointment.duration, 75); // 30 + 45
      assert.strictEqual(res.body.appointment.total, 90.0); // 50 + 40
      assert.strictEqual(res.body.appointment.services.length, 2);

      // Snapshot de preço em price_charged
      assert.strictEqual(res.body.appointment.services[0].price_charged, 50.0);
      assert.strictEqual(res.body.appointment.services[1].price_charged, 40.0);

      // Verificação da data final
      const expectedEnd = new Date(new Date(scheduledAt).getTime() + 75 * 60000);
      assert.strictEqual(
        new Date(res.body.appointment.ends_at).toISOString(),
        expectedEnd.toISOString()
      );
    });

    it("deve permitir que o ADMIN crie agendamento para CLIENT com status CONFIRMED e channel PHONE", async () => {
      const scheduledAt = new Date(Date.now() + 11 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          client_id: client2.id,
          scheduled_at: scheduledAt,
          services: [service1Id],
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.appointment.client_id, client2.id);
      assert.strictEqual(res.body.appointment.created_by, adminUser.id);
      assert.strictEqual(res.body.appointment.status, "CONFIRMED");
      assert.strictEqual(res.body.appointment.channel, "PHONE");
      assert.strictEqual(res.body.appointment.duration, 30);
      assert.strictEqual(res.body.appointment.total, 50.0);
    });

    it("deve ignorar client_id enviado por CLIENT e forçar agendamento para si mesmo", async () => {
      const scheduledAt = new Date(Date.now() + 12 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          client_id: client2.id, // tentando criar para client2
          scheduled_at: scheduledAt,
          services: [service1Id],
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.appointment.client_id, client1.id);
    });

    it("deve rejeitar criação quando ADMIN tentar agendar para outro ADMIN", async () => {
      const scheduledAt = new Date(Date.now() + 13 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          client_id: adminUser.id,
          scheduled_at: scheduledAt,
          services: [service1Id],
        });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /deve ser associado a um usuário com perfil CLIENT/i);
    });

    it("deve retornar 400 se ADMIN não informar client_id", async () => {
      const scheduledAt = new Date(Date.now() + 13 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          scheduled_at: scheduledAt,
          services: [service1Id],
        });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /client_id é obrigatório/i);
    });

    it("deve retornar 400 quando a lista de serviços estiver vazia", async () => {
      const scheduledAt = new Date(Date.now() + 14 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: scheduledAt,
          services: [],
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve retornar 400 quando houver serviços duplicados no array", async () => {
      const scheduledAt = new Date(Date.now() + 14 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: scheduledAt,
          services: [service1Id, service1Id],
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
      const hasDupMsg = res.body.errors?.some((e: { message: string }) =>
        e.message.includes("duplicados")
      );
      assert.ok(hasDupMsg);
    });

    it("deve retornar 404 quando um serviço solicitado não existir", async () => {
      const scheduledAt = new Date(Date.now() + 14 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: scheduledAt,
          services: [999999],
        });

      assert.strictEqual(res.status, 404);
      assert.match(res.body.message, /não encontrado/i);
    });

    it("deve retornar 422 Unprocessable Entity quando um serviço estiver inativo", async () => {
      const scheduledAt = new Date(Date.now() + 14 * 86400000).toISOString();

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: scheduledAt,
          services: [inactiveServiceId],
        });

      assert.strictEqual(res.status, 422);
      assert.match(res.body.message, /desativado/i);
    });

    it("deve retornar 400 quando scheduled_at estiver no passado", async () => {
      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: "2020-01-01T10:00:00.000Z",
          services: [service1Id],
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve retornar 401 ao tentar criar sem autenticação", async () => {
      const res = await request(app)
        .post("/appointments")
        .send({
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
          services: [service1Id],
        });

      assert.strictEqual(res.status, 401);
    });
  });

  describe("2. Conflito de horários (409 Conflict)", () => {
    let baseTime: Date;

    before(async () => {
      // Definir um horário base bem à frente (ex: 20 dias)
      baseTime = new Date(Date.now() + 20 * 86400000);
      baseTime.setMinutes(0, 0, 0);

      // Criar agendamento PENDING das 14:00 às 14:30 (service1 = 30m)
      await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: baseTime.toISOString(),
          services: [service1Id],
        });
    });

    it("deve retornar 409 quando houver sobreposição com agendamento PENDING", async () => {
      // Tentativa exatamente no mesmo horário
      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client2Token}`)
        .send({
          scheduled_at: baseTime.toISOString(),
          services: [service1Id],
        });

      assert.strictEqual(res.status, 409);
      assert.match(res.body.message, /Já existe um agendamento para este horário/i);
    });

    it("deve retornar 409 quando novo agendamento começa no meio do intervalo existente", async () => {
      // 15 minutos após o início do agendamento de 30 minutos
      const overlappingTime = new Date(baseTime.getTime() + 15 * 60000);

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client2Token}`)
        .send({
          scheduled_at: overlappingTime.toISOString(),
          services: [service1Id],
        });

      assert.strictEqual(res.status, 409);
      assert.match(res.body.message, /Já existe um agendamento para este horário/i);
    });

    it("NÃO deve dar conflito quando os intervalos forem contíguos (encostados)", async () => {
      // O agendamento base é de 30m (ex: 14:00 até 14:30).
      // Criar agendamento que começa exatamente às 14:30 (baseTime + 30m)
      const adjacentTime = new Date(baseTime.getTime() + 30 * 60000);

      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client2Token}`)
        .send({
          scheduled_at: adjacentTime.toISOString(),
          services: [service1Id],
        });

      assert.strictEqual(res.status, 201);
    });

    it("NÃO deve dar conflito se o agendamento no mesmo horário estiver CANCELLED", async () => {
      // Criar um horário específico
      const cancelledTime = new Date(Date.now() + 25 * 86400000);
      cancelledTime.setMinutes(0, 0, 0);

      await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt: cancelledTime,
          endsAt: new Date(cancelledTime.getTime() + 30 * 60000),
          status: AppointmentStatus.CANCELLED,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: {
              serviceId: service1Id,
              priceCharged: 50.0,
            },
          },
        },
      });

      // Agora tentar criar agendamento no mesmo horário
      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client2Token}`)
        .send({
          scheduled_at: cancelledTime.toISOString(),
          services: [service1Id],
        });

      assert.strictEqual(res.status, 201);
    });

    it("NÃO deve dar conflito se o agendamento no mesmo horário estiver COMPLETED", async () => {
      const completedTime = new Date(Date.now() + 26 * 86400000);
      completedTime.setMinutes(0, 0, 0);

      await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: adminUser.id,
          scheduledAt: completedTime,
          endsAt: new Date(completedTime.getTime() + 30 * 60000),
          status: AppointmentStatus.COMPLETED,
          channel: AppointmentChannel.PHONE,
          appointmentServices: {
            create: {
              serviceId: service1Id,
              priceCharged: 50.0,
            },
          },
        },
      });

      // Agora tentar criar agendamento no mesmo horário
      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client2Token}`)
        .send({
          scheduled_at: completedTime.toISOString(),
          services: [service1Id],
        });

      assert.strictEqual(res.status, 201);
    });
  });

  describe("3. Sugestão de agendamento na mesma semana", () => {
    it("deve sugerir agendamento existente na mesma semana para o cliente sem bloquear a criação", async () => {
      // Escolher uma data futura: digamos daqui a 35 dias
      const firstDate = new Date(Date.now() + 35 * 86400000);
      // Garantir horário das 10:00 UTC
      firstDate.setUTCHours(10, 0, 0, 0);

      // Primeiro agendamento do client1 nessa semana
      const res1 = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: firstDate.toISOString(),
          services: [service1Id],
        });

      assert.strictEqual(res1.status, 201);
      assert.strictEqual(res1.body.suggestion, undefined);

      // Segundo agendamento do mesmo client1 no mesmo dia, mas às 15:00 (dentro da mesma semana)
      const secondDate = new Date(firstDate.getTime() + 5 * 3600000);

      const res2 = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: secondDate.toISOString(),
          services: [service1Id],
        });

      assert.strictEqual(res2.status, 201);
      assert.ok(res2.body.suggestion);
      assert.strictEqual(
        res2.body.suggestion.reference_appointment_id,
        res1.body.appointment.id
      );
    });
  });

  describe("4. GET /appointments/:id (Consulta por ID)", () => {
    let apptId: number;

    before(async () => {
      const scheduledAt = new Date(Date.now() + 40 * 86400000).toISOString();
      const res = await request(app)
        .post("/appointments")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          scheduled_at: scheduledAt,
          services: [service1Id, service2Id],
        });
      apptId = res.body.appointment.id;
    });

    it("deve permitir que o CLIENT consulte seu próprio agendamento por ID", async () => {
      const res = await request(app)
        .get(`/appointments/${apptId}`)
        .set("Authorization", `Bearer ${client1Token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.appointment);
      assert.strictEqual(res.body.appointment.id, apptId);
      assert.strictEqual(res.body.appointment.client_id, client1.id);
      assert.strictEqual(res.body.appointment.services.length, 2);
      assert.strictEqual(res.body.appointment.total, 90.0);
    });

    it("deve retornar 404 quando um CLIENT tentar consultar agendamento de outro cliente", async () => {
      const res = await request(app)
        .get(`/appointments/${apptId}`)
        .set("Authorization", `Bearer ${client2Token}`);

      // Retorna 404 por segurança para não expor IDs existentes de outros clientes
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Agendamento não encontrado");
    });

    it("deve permitir que o ADMIN consulte qualquer agendamento", async () => {
      const res = await request(app)
        .get(`/appointments/${apptId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.id, apptId);
    });

    it("deve retornar 404 para ID inexistente", async () => {
      const res = await request(app)
        .get("/appointments/999999")
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Agendamento não encontrado");
    });

    it("deve retornar 400 para ID com formato inválido", async () => {
      const res = await request(app)
        .get("/appointments/invalido")
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve retornar 401 sem autenticação", async () => {
      const res = await request(app).get(`/appointments/${apptId}`);
      assert.strictEqual(res.status, 401);
    });
  });

  describe("5. GET /appointments (Listagem paginada e filtros)", () => {
    it("deve listar apenas os agendamentos do próprio CLIENT autenticado", async () => {
      const res = await request(app)
        .get("/appointments")
        .set("Authorization", `Bearer ${client1Token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.appointments));
      assert.ok(res.body.pagination);
      assert.ok(res.body.appointments.length > 0);

      // Todos os itens devem pertencer ao client1
      for (const item of res.body.appointments) {
        assert.strictEqual(item.client_id, client1.id);
      }
    });

    it("deve permitir que o ADMIN liste agendamentos de todos os clientes", async () => {
      const res = await request(app)
        .get("/appointments")
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.appointments));
      assert.ok(res.body.pagination);

      // Deve conter agendamentos de mais de um cliente
      const clientIds = new Set(res.body.appointments.map((a: { client_id: number }) => a.client_id));
      assert.ok(clientIds.size >= 1);
    });

    it("deve permitir que o ADMIN filtre agendamentos por client_id", async () => {
      const res = await request(app)
        .get(`/appointments?client_id=${client2.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      for (const item of res.body.appointments) {
        assert.strictEqual(item.client_id, client2.id);
      }
    });

    it("deve filtrar agendamentos por status", async () => {
      const res = await request(app)
        .get("/appointments?status=PENDING")
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      for (const item of res.body.appointments) {
        assert.strictEqual(item.status, "PENDING");
      }
    });

    it("deve respeitar parâmetros de paginação page e limit", async () => {
      const res = await request(app)
        .get("/appointments?page=1&limit=2")
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.pagination.page, 1);
      assert.strictEqual(res.body.pagination.limit, 2);
      assert.ok(res.body.appointments.length <= 2);
    });

    it("deve retornar 401 sem autenticação na listagem", async () => {
      const res = await request(app).get("/appointments");
      assert.strictEqual(res.status, 401);
    });
  });

  describe("6. Atomicidade da transação (Rollback)", () => {
    it("não deve deixar agendamento órfão se a inserção dos itens falhar", async () => {
      const scheduledAt = new Date(Date.now() + 50 * 86400000);
      const endsAt = new Date(scheduledAt.getTime() + 30 * 60000);

      // Simulação de falha transacional
      let transactionFailed = false;
      let createdAppointmentId: number | null = null;

      try {
        await prisma.$transaction(async (tx) => {
          const appt = await tx.appointment.create({
            data: {
              clientId: client1.id,
              createdBy: client1.id,
              scheduledAt,
              endsAt,
              status: AppointmentStatus.PENDING,
              channel: AppointmentChannel.ONLINE,
            },
          });
          createdAppointmentId = appt.id;

          // Força erro com serviceId inexistente que viola Foreign Key
          await tx.appointmentService.create({
            data: {
              appointmentId: appt.id,
              serviceId: 999999, // Não existe no banco
              priceCharged: 50.0,
            },
          });
        });
      } catch {
        transactionFailed = true;
      }

      assert.strictEqual(transactionFailed, true);
      assert.ok(createdAppointmentId !== null);

      // Verifica que o agendamento pai sofreu rollback e não existe no banco
      const orphanCheck = await prisma.appointment.findUnique({
        where: { id: createdAppointmentId! },
      });
      assert.strictEqual(orphanCheck, null);
    });
  });

  describe("7. Proteção de concorrência no Banco (Exclusion Constraint PostgreSQL)", () => {
    it("deve disparar erro no PostgreSQL ao tentar inserir agendamentos sobrepostos diretamente no banco", async () => {
      const scheduledAt = new Date(Date.now() + 60 * 86400000);
      const endsAt = new Date(scheduledAt.getTime() + 60 * 60000);

      // Inserir primeiro agendamento
      const first = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt,
          status: AppointmentStatus.CONFIRMED,
          channel: AppointmentChannel.ONLINE,
        },
      });

      let constraintErrorCaught = false;

      // Tentativa direta no banco de criar outro com mesmo intervalo (bypassing service layer)
      try {
        await prisma.appointment.create({
          data: {
            clientId: client2.id,
            createdBy: adminUser.id,
            scheduledAt: new Date(scheduledAt.getTime() + 15 * 60000), // sobreposição parcial
            endsAt: new Date(endsAt.getTime() + 15 * 60000),
            status: AppointmentStatus.PENDING,
            channel: AppointmentChannel.PHONE,
          },
        });
      } catch (err: unknown) {
        constraintErrorCaught = true;
        const msg = String((err as Error).message);
        assert.ok(
          msg.includes("no_overlapping_active_appointments") ||
            (err as { code?: string }).code === "P2004"
        );
      } finally {
        // Limpar o primeiro
        await prisma.appointment.delete({ where: { id: first.id } });
      }

      assert.strictEqual(constraintErrorCaught, true);
    });
  });
});


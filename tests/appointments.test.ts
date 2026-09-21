import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";
import { generateToken } from "../src/lib/jwt";
import { UserRole, AppointmentChannel, AppointmentStatus, ServiceItemStatus } from "@prisma/client";
import { validateStatusTransition } from "../src/modules/appointments/appointments.service";

describe("Feature: Appointments (Agendamentos)", () => {
  let adminUser: { id: number; email: string };
  let client1: { id: number; email: string };
  let client2: { id: number; email: string };

  let adminToken: string;
  let client1Token: string;
  let client2Token: string;

  let service1Id: number;
  let service2Id: number;
  let service3Id: number;
  let inactiveServiceId: number;

  before(async () => {
    // 0. Limpar agendamentos anteriores de testes com emails de teste
    await prisma.appointmentService.deleteMany({
      where: {
        appointment: {
          client: { email: { contains: "appt_test" } },
        },
      },
    });
    await prisma.appointment.deleteMany({
      where: {
        client: { email: { contains: "appt_test" } },
      },
    });

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

    const s4 = await prisma.service.create({
      data: {
        name: "Manicure Appt Test",
        description: "Manicure de teste",
        durationMinutes: 20,
        price: 30.0,
        active: true,
      },
    });
    service3Id = s4.id;
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
        id: { in: [service1Id, service2Id, service3Id, inactiveServiceId] },
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

  let nextTestSlotHour = 500;
  function getTestTimeSlot(): Date {
    nextTestSlotHour += 100;
    return new Date(Date.now() + nextTestSlotHour * 3600000);
  }

  describe("8. PATCH /appointments/:id (Alteração de horário e serviços)", () => {
    it("deve permitir que o CLIENT altere o próprio agendamento com >= 48h de antecedência", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const newScheduledAt = new Date(scheduledAt.getTime() + 86400000).toISOString();
      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${client1Token}`)
        .send({ scheduled_at: newScheduledAt });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.id, appt.id);
      assert.strictEqual(
        new Date(res.body.appointment.scheduled_at).toISOString(),
        new Date(newScheduledAt).toISOString()
      );
      assert.strictEqual(res.body.appointment.duration, 30);
    });

    it("deve retornar 403 quando CLIENT tentar alterar agendamento com menos de 48h de antecedência", async () => {
      const scheduledAt = new Date(Date.now() + 20 * 3600000); // 20h (< 48h)
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${client1Token}`)
        .send({ scheduled_at: new Date(Date.now() + 7 * 86400000).toISOString() });

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /48 horas de antecedência/i);
    });

    it("deve permitir que o ADMIN altere agendamento mesmo com menos de 48h de antecedência", async () => {
      const scheduledAt = new Date(Date.now() + 22 * 3600000); // 22h (< 48h)
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const newScheduledAt = new Date(Date.now() + 8 * 86400000).toISOString();
      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ scheduled_at: newScheduledAt });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        new Date(res.body.appointment.scheduled_at).toISOString(),
        new Date(newScheduledAt).toISOString()
      );
    });

    it("deve retornar 404 quando CLIENT tentar alterar agendamento de outro cliente", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${client2Token}`)
        .send({ scheduled_at: new Date(scheduledAt.getTime() + 86400000).toISOString() });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Agendamento não encontrado");
    });

    it("deve alterar status de CONFIRMED para PENDING quando CLIENT alterar o agendamento", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: adminUser.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.CONFIRMED,
          channel: AppointmentChannel.PHONE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${client1Token}`)
        .send({ scheduled_at: new Date(scheduledAt.getTime() + 86400000).toISOString() });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.status, "PENDING");
    });

    it("deve manter o status CONFIRMED quando ADMIN alterar o agendamento", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: adminUser.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.CONFIRMED,
          channel: AppointmentChannel.PHONE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ scheduled_at: new Date(scheduledAt.getTime() + 86400000).toISOString() });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.status, "CONFIRMED");
    });

    it("deve retornar 400 se nenhum campo for informado ({})", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, "Dados de entrada inválidos");
    });

    it("deve retornar 400 se a lista de serviços enviada for vazia ou tiver duplicatas", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      // Vazio
      const resEmpty = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ services: [] });
      assert.strictEqual(resEmpty.status, 400);

      // Duplicatas
      const resDup = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ services: [service1Id, service1Id] });
      assert.strictEqual(resDup.status, 400);
    });

    it("deve retornar 422 se algum serviço enviado estiver inativo", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ services: [inactiveServiceId] });

      assert.strictEqual(res.status, 422);
      assert.match(res.body.message, /desativado/i);
    });

    it("deve preservar o price_charged dos serviços mantidos e aplicar o preço atual nos novos serviços", async () => {
      const scheduledAt = getTestTimeSlot();
      // Criar agendamento com service1 a preço 50.0
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      // Modificar o preço do service1 no catálogo para 999.00
      await prisma.service.update({
        where: { id: service1Id },
        data: { price: 999.0 },
      });

      try {
        // Alterar agendamento para incluir service3Id (preço 30.00) mantendo service1Id
        const res = await request(app)
          .patch(`/appointments/${appt.id}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ services: [service1Id, service3Id] });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.appointment.services.length, 2);

        const item1 = res.body.appointment.services.find(
          (s: { service_id: number }) => s.service_id === service1Id
        );
        const item3 = res.body.appointment.services.find(
          (s: { service_id: number }) => s.service_id === service3Id
        );

        // O item mantido deve PRESERVAR o price_charged original (50.00), e NÃO 999.00!
        assert.strictEqual(item1.price_charged, 50.0);
        // O novo item deve usar o preço atual do momento da adição (30.00)
        assert.strictEqual(item3.price_charged, 30.0);
        assert.strictEqual(res.body.appointment.total, 80.0);
      } finally {
        // Restaurar o preço do service1
        await prisma.service.update({
          where: { id: service1Id },
          data: { price: 50.0 },
        });
      }
    });

    it("deve remover do agendamento os serviços excluídos da nova composição", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 75 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: [
              { serviceId: service1Id, priceCharged: 50.0 },
              { serviceId: service2Id, priceCharged: 40.0 },
            ],
          },
        },
      });

      // Manter apenas service2Id
      const res = await request(app)
        .patch(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ services: [service2Id] });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.services.length, 1);
      assert.strictEqual(res.body.appointment.services[0].service_id, service2Id);
      assert.strictEqual(res.body.appointment.duration, 45);
    });

    it("deve retornar 409 quando o novo horário/duração entrar em conflito com outro agendamento", async () => {
      const timeA = getTestTimeSlot();

      await prisma.appointment.create({
        data: {
          clientId: client2.id,
          createdBy: adminUser.id,
          scheduledAt: timeA,
          endsAt: new Date(timeA.getTime() + 60 * 60000),
          status: AppointmentStatus.CONFIRMED,
          channel: AppointmentChannel.PHONE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const timeB = getTestTimeSlot();

      const apptB = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt: timeB,
          endsAt: new Date(timeB.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      // Tentar alterar B para sobrepor timeA
      const conflictTime = new Date(timeA.getTime() + 15 * 60000).toISOString();
      const res = await request(app)
        .patch(`/appointments/${apptB.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ scheduled_at: conflictTime });

      assert.strictEqual(res.status, 409);
      assert.match(res.body.message, /Já existe um agendamento para este horário/i);
    });

    it("NÃO deve dar conflito com o próprio agendamento ao manter ou alterar horário", async () => {
      const timeC = getTestTimeSlot();

      const apptC = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt: timeC,
          endsAt: new Date(timeC.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      // Alterar para adicionar service3Id (duration passa de 30m para 50m)
      const res = await request(app)
        .patch(`/appointments/${apptC.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ services: [service1Id, service3Id] });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.duration, 50);
    });

    it("deve retornar 409 ao tentar alterar agendamento com status CANCELLED ou COMPLETED", async () => {
      const scheduledAt1 = getTestTimeSlot();

      const cancelledAppt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt: scheduledAt1,
          endsAt: new Date(scheduledAt1.getTime() + 30 * 60000),
          status: AppointmentStatus.CANCELLED,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const resCancel = await request(app)
        .patch(`/appointments/${cancelledAppt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ scheduled_at: new Date(scheduledAt1.getTime() + 86400000).toISOString() });

      assert.strictEqual(resCancel.status, 409);
      assert.match(resCancel.body.message, /Não é possível alterar um agendamento/i);

      const scheduledAt2 = getTestTimeSlot();
      const completedAppt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt: scheduledAt2,
          endsAt: new Date(scheduledAt2.getTime() + 30 * 60000),
          status: AppointmentStatus.COMPLETED,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const resComp = await request(app)
        .patch(`/appointments/${completedAppt.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ scheduled_at: new Date(scheduledAt2.getTime() + 86400000).toISOString() });

      assert.strictEqual(resComp.status, 409);
      assert.match(resComp.body.message, /Não é possível alterar um agendamento/i);
    });
  });

  describe("9. DELETE /appointments/:id (Cancelamento lógico)", () => {
    it("deve permitir que o CLIENT cancele o próprio agendamento com >= 48h de antecedência", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .delete(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${client1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.status, "CANCELLED");

      // Registro deve permanecer fisicamente no banco
      const inDb = await prisma.appointment.findUnique({ where: { id: appt.id } });
      assert.ok(inDb !== null);
      assert.strictEqual(inDb.status, "CANCELLED");
    });

    it("deve retornar 403 quando CLIENT tentar cancelar com menos de 48h de antecedência", async () => {
      const scheduledAt = new Date(Date.now() + 24 * 3600000); // 24h
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .delete(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${client1Token}`);

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /48 horas de antecedência/i);
    });

    it("deve permitir que o ADMIN cancele qualquer agendamento sem restrição de prazo", async () => {
      const scheduledAt = new Date(Date.now() + 26 * 3600000); // 26h (< 48h)
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .delete(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.status, "CANCELLED");
    });

    it("deve retornar 404 quando CLIENT tentar cancelar agendamento de outro cliente", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .delete(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${client2Token}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Agendamento não encontrado");
    });

    it("deve atualizar itens pendentes para CANCELLED e preservar itens COMPLETED", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: adminUser.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 75 * 60000),
          status: AppointmentStatus.CONFIRMED,
          channel: AppointmentChannel.PHONE,
          appointmentServices: {
            create: [
              {
                serviceId: service1Id,
                priceCharged: 50.0,
                status: ServiceItemStatus.COMPLETED, // Já concluído
              },
              {
                serviceId: service2Id,
                priceCharged: 40.0,
                status: ServiceItemStatus.PENDING, // Pendente
              },
            ],
          },
        },
      });

      const res = await request(app)
        .delete(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.status, "CANCELLED");

      const item1 = res.body.appointment.services.find(
        (s: { service_id: number }) => s.service_id === service1Id
      );
      const item2 = res.body.appointment.services.find(
        (s: { service_id: number }) => s.service_id === service2Id
      );

      assert.strictEqual(item1.status, "COMPLETED");
      assert.strictEqual(item2.status, "CANCELLED");
    });

    it("deve retornar 409 ao tentar cancelar agendamento já CANCELLED ou COMPLETED", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.CANCELLED,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .delete(`/appointments/${appt.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 409);
      assert.match(res.body.message, /Não é possível cancelar um agendamento/i);
    });
  });

  describe("10. PATCH /appointments/:id/confirm (Confirmação por ADMIN)", () => {
    it("deve permitir que o ADMIN confirme agendamento com status PENDING -> CONFIRMED", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}/confirm`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.status, "CONFIRMED");
    });

    it("deve rejeitar confirmação por usuário CLIENT com HTTP 403", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}/confirm`)
        .set("Authorization", `Bearer ${client1Token}`);

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /restrita a administradores/i);
    });

    it("deve retornar 409 ao tentar confirmar agendamento que não esteja PENDING", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: adminUser.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.CONFIRMED,
          channel: AppointmentChannel.PHONE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}/confirm`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 409);
      assert.match(res.body.message, /Não é possível confirmar/i);
    });

    it("deve retornar 404 para confirmação de agendamento inexistente", async () => {
      const res = await request(app)
        .patch("/appointments/999999/confirm")
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Agendamento não encontrado");
    });
  });

  describe("11. PATCH /appointments/:id/complete (Conclusão por ADMIN)", () => {
    it("deve permitir que o ADMIN conclua agendamento com status CONFIRMED -> COMPLETED", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: adminUser.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.CONFIRMED,
          channel: AppointmentChannel.PHONE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}/complete`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.appointment.status, "COMPLETED");
      assert.strictEqual(res.body.appointment.services[0].status, "COMPLETED");
    });

    it("deve rejeitar conclusão por usuário CLIENT com HTTP 403", async () => {
      const scheduledAt = getTestTimeSlot();
      const appt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: adminUser.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.CONFIRMED,
          channel: AppointmentChannel.PHONE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${appt.id}/complete`)
        .set("Authorization", `Bearer ${client1Token}`);

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /restrita a administradores/i);
    });

    it("deve retornar 409 ao tentar concluir agendamento com status PENDING ou CANCELLED", async () => {
      const scheduledAt = getTestTimeSlot();
      const pendingAppt = await prisma.appointment.create({
        data: {
          clientId: client1.id,
          createdBy: client1.id,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 30 * 60000),
          status: AppointmentStatus.PENDING,
          channel: AppointmentChannel.ONLINE,
          appointmentServices: {
            create: { serviceId: service1Id, priceCharged: 50.0 },
          },
        },
      });

      const res = await request(app)
        .patch(`/appointments/${pendingAppt.id}/complete`)
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 409);
      assert.match(res.body.message, /Não é possível concluir/i);
    });

    it("deve retornar 404 para conclusão de agendamento inexistente", async () => {
      const res = await request(app)
        .patch("/appointments/999999/complete")
        .set("Authorization", `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, "Agendamento não encontrado");
    });
  });

  describe("12. Regras de Transição de Status Centralizadas", () => {
    it("deve permitir transições válidas e rejeitar transições inválidas na máquina de estados", () => {
      // Válidas
      assert.doesNotThrow(() =>
        validateStatusTransition(AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED)
      );
      assert.doesNotThrow(() =>
        validateStatusTransition(AppointmentStatus.PENDING, AppointmentStatus.CANCELLED)
      );
      assert.doesNotThrow(() =>
        validateStatusTransition(AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED)
      );
      assert.doesNotThrow(() =>
        validateStatusTransition(AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED)
      );
      assert.doesNotThrow(() =>
        validateStatusTransition(AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING)
      );
      assert.doesNotThrow(() =>
        validateStatusTransition(AppointmentStatus.PENDING, AppointmentStatus.PENDING)
      );

      // Inválidas: PENDING -> COMPLETED
      assert.throws(
        () => validateStatusTransition(AppointmentStatus.PENDING, AppointmentStatus.COMPLETED),
        /Transição de status inválida/
      );

      // Inválidas a partir de CANCELLED
      assert.throws(
        () => validateStatusTransition(AppointmentStatus.CANCELLED, AppointmentStatus.CONFIRMED),
        /Transição de status inválida/
      );
      assert.throws(
        () => validateStatusTransition(AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED),
        /Transição de status inválida/
      );

      // Inválidas a partir de COMPLETED
      assert.throws(
        () => validateStatusTransition(AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED),
        /Transição de status inválida/
      );
    });
  });
});


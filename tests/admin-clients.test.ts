import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";
import { generateToken } from "../src/lib/jwt";
import { normalizePhone } from "../src/lib/phone";

describe("Feature: Clientes criados pelo Admin", () => {
  it("deve normalizar telefones para comparação consistente", () => {
    assert.strictEqual(normalizePhone("(18) 99999-9999"), "18999999999");
    assert.strictEqual(normalizePhone("+55 18 99999-9999"), "5518999999999");
    assert.strictEqual(normalizePhone("18 99999-9999"), "18999999999");
  });

  it("deve permitir ADMIN criar cliente sem email e sem senha de login", async () => {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) {
      throw new Error("Usuário ADMIN de seed não encontrado");
    }

    const token = generateToken({ sub: String(admin.id), role: "ADMIN" });

    const res = await request(app)
      .post("/appointments/clients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Cliente sem conta",
        phone: "(18) 99999-9999",
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.client.name, "Cliente sem conta");
    assert.strictEqual(res.body.client.phone, "18999999999");
    assert.strictEqual(res.body.client.email, null);
    assert.strictEqual(res.body.client.password_hash, undefined);

    const inDb = await prisma.user.findUnique({ where: { id: res.body.client.id } });
    assert.ok(inDb);
    assert.strictEqual(inDb?.email, null);
    assert.strictEqual(inDb?.passwordHash, null);
  });

  it("deve permitir ADMIN pesquisar clientes por telefone ou nome", async () => {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) {
      throw new Error("Usuário ADMIN de seed não encontrado");
    }

    const token = generateToken({ sub: String(admin.id), role: "ADMIN" });

    const res = await request(app)
      .get("/appointments/clients/search")
      .set("Authorization", `Bearer ${token}`)
      .query({ q: "99999" });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.clients));
    assert.ok(res.body.clients.length >= 1);
  });
});

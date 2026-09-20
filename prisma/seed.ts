import "dotenv/config";
import process from "process";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // 1. Usuário ADMIN
  const adminEmail = process.env.ADMIN_EMAIL || "admin@leilahairbeauty.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
  const adminName = process.env.ADMIN_NAME || "Leila Silva";
  const adminPhone = process.env.ADMIN_PHONE || "11999998888";

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      phone: adminPhone,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
    create: {
      name: adminName,
      email: adminEmail,
      phone: adminPhone,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });
  console.log(`Usuário ADMIN pronto: ${adminUser.email} (ID: ${adminUser.id})`);

  // 2. Usuário CLIENT de exemplo
  const clientEmail = "cliente@exemplo.com";
  const clientPassword = "Cliente@123456";
  const clientPasswordHash = await bcrypt.hash(clientPassword, 10);

  const clientUser = await prisma.user.upsert({
    where: { email: clientEmail },
    update: {
      name: "Maria Oliveira",
      phone: "11988887777",
      passwordHash: clientPasswordHash,
      role: UserRole.CLIENT,
    },
    create: {
      name: "Maria Oliveira",
      email: clientEmail,
      phone: "11988887777",
      passwordHash: clientPasswordHash,
      role: UserRole.CLIENT,
    },
  });
  console.log(`Usuário CLIENT pronto: ${clientUser.email} (ID: ${clientUser.id})`);

  // 3. 5 Serviços realistas
  const servicesData = [
    {
      name: "Corte Feminino",
      description: "Corte personalizado com lavagem e finalização básica",
      durationMinutes: 45,
      price: 80.0,
      active: true,
    },
    {
      name: "Escova Modeladora",
      description: "Lavagem especial e escovação com modelagem dos fios",
      durationMinutes: 40,
      price: 60.0,
      active: true,
    },
    {
      name: "Coloração Completa",
      description: "Aplicação de tintura profissional da raiz às pontas",
      durationMinutes: 90,
      price: 180.0,
      active: true,
    },
    {
      name: "Manicure Tradicional",
      description: "Cuidado completo com cutículas, lixamento e esmaltação",
      durationMinutes: 45,
      price: 40.0,
      active: true,
    },
    {
      name: "Hidratação Profunda",
      description: "Tratamento capilar intensivo para recuperação e brilho dos fios",
      durationMinutes: 50,
      price: 120.0,
      active: true,
    },
  ];

  for (const s of servicesData) {
    const existing = await prisma.service.findFirst({
      where: { name: s.name },
    });

    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: s,
      });
    } else {
      await prisma.service.create({
        data: s,
      });
    }
  }

  console.log("5 serviços criados/atualizados com sucesso.");
  console.log("Seed finalizado com sucesso.");
}

main()
  .catch((e) => {
    console.error("Erro durante a execução do seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


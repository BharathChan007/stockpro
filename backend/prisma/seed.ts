import { PrismaClient, UserRole, VehicleStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.globalConfig.upsert({
    where: { id: 1 },
    create: { id: 1, defaultBlockingDays: 7 },
    update: {},
  });

  const branchNames = [
    "North Plaza",
    "South Plaza",
    "East Wing",
    "West Wing",
    "Central Hub",
    "Harbour Showroom",
    "Metro Crossing",
    "Lakeview",
    "Highway Stop",
    "Garden City",
    "Tech Park",
    "Airport Boulevard",
  ];

  const branches = [];
  for (let i = 0; i < branchNames.length; i++) {
    const b = await prisma.branch.upsert({
      where: { id: `seed-branch-${i + 1}` },
      create: {
        id: `seed-branch-${i + 1}`,
        name: branchNames[i],
        location: `City ${i + 1}`,
      },
      update: {},
    });
    branches.push(b);
  }

  const adminHash = await bcrypt.hash("ChangeMe12345", 12);
  await prisma.user.upsert({
    where: { loginId: "admin" },
    create: {
      loginId: "admin",
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      fullName: "Stock Manager",
      branchId: null,
    },
    update: {},
  });

  const salesHash = await bcrypt.hash("ChangeMe12345", 12);
  await prisma.user.upsert({
    where: { loginId: "sales1" },
    create: {
      loginId: "sales1",
      passwordHash: salesHash,
      role: UserRole.SALES_MANAGER,
      fullName: "Sales Manager One",
      branchId: branches[0].id,
    },
    update: {},
  });

  const samples = [
    {
      chassisNumber: "CHS-INV-001",
      chassisYear: 2024,
      model: "Innova Crysta",
      suffix: "ZX",
      colour: "White Pearl",
      stockyardLocation: "Zone A",
    },
    {
      chassisNumber: "CHS-INV-002",
      chassisYear: 2024,
      model: "Innova Crysta",
      suffix: "ZX",
      colour: "White Pearl",
      stockyardLocation: "Zone A",
    },
    {
      chassisNumber: "CHS-FOR-001",
      chassisYear: 2025,
      model: "Fortuner",
      suffix: "GR-S",
      colour: "Attitude Black",
      stockyardLocation: "Zone B",
    },
  ];

  for (const s of samples) {
    await prisma.vehicle.upsert({
      where: { chassisNumber: s.chassisNumber },
      create: {
        chassisNumber: s.chassisNumber,
        chassisYear: s.chassisYear,
        model: s.model,
        suffix: s.suffix,
        colour: s.colour,
        stockyardLocation: s.stockyardLocation,
        dateOfArrival: new Date(),
        status: VehicleStatus.OPEN,
      },
      update: {
        chassisYear: s.chassisYear,
        model: s.model,
        suffix: s.suffix,
        colour: s.colour,
        stockyardLocation: s.stockyardLocation,
      },
    });
  }

  await prisma.modelConfig.upsert({
    where: { modelName: "Innova Crysta" },
    create: { modelName: "Innova Crysta", blockingDurationDays: 7 },
    update: {},
  });
  await prisma.modelConfig.upsert({
    where: { modelName: "Fortuner" },
    create: { modelName: "Fortuner", blockingDurationDays: 10 },
    update: {},
  });

  console.log("Seed OK — login admin / ChangeMe12345 or sales1 / ChangeMe12345");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

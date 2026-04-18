import { Router } from "express";
import { BlockingRecordStatus, BlockType, VehicleStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/summary", async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  const [
    totalVehicles,
    openCount,
    hardBlocked,
    softBlocked,
    deliveredVehicles,
    expiredBlocks,
  ] = await Promise.all([
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { status: VehicleStatus.OPEN } }),
    prisma.vehicle.count({ where: { status: VehicleStatus.HARD_BLOCKED } }),
    prisma.vehicle.count({ where: { status: VehicleStatus.SOFT_BLOCKED } }),
    prisma.vehicle.count({ where: { status: VehicleStatus.DELIVERED } }),
    prisma.blockingRequest.count({ where: { status: BlockingRecordStatus.EXPIRED } }),
  ]);

  res.json({
    totalVehicles,
    open: openCount,
    hardBlocked,
    softBlocked,
    delivered: deliveredVehicles,
    expiredBlockings: expiredBlocks,
  });
});

router.get("/daywise", async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  const rows = await prisma.blockingRequest.findMany({
    where: {
      blockType: BlockType.HARD,
      expiryAt: { not: null },
      status: BlockingRecordStatus.ACTIVE,
    },
    select: { expiryAt: true },
  });
  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (!r.expiryAt) continue;
    const key = r.expiryAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  res.json([...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)));
});

router.get("/branchwise", async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });
  const out = [];
  for (const b of branches) {
    const [activeBlocks, deliveries, expired] = await Promise.all([
      prisma.blockingRequest.count({
        where: { branchId: b.id, status: BlockingRecordStatus.ACTIVE, blockType: BlockType.HARD },
      }),
      prisma.blockingRequest.count({
        where: { branchId: b.id, status: BlockingRecordStatus.DELIVERED },
      }),
      prisma.blockingRequest.count({
        where: { branchId: b.id, status: BlockingRecordStatus.EXPIRED },
      }),
    ]);
    const denom = activeBlocks + deliveries + expired;
    const conversion = denom === 0 ? 0 : deliveries / denom;
    out.push({
      branchId: b.id,
      branchName: b.name,
      activeHardBlockings: activeBlocks,
      deliveries,
      expiredBlockings: expired,
      conversionRate: Math.round(conversion * 1000) / 1000,
    });
  }
  res.json(out);
});

router.get("/modelwise", async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  const vehicles = await prisma.vehicle.findMany({ select: { model: true } });
  const models = [...new Set(vehicles.map((v) => v.model))];
  const out = [];
  for (const model of models) {
    const blocks = await prisma.blockingRequest.count({
      where: { vehicle: { is: { model } }, blockType: BlockType.HARD },
    });
    const delivered = await prisma.blockingRequest.count({
      where: { vehicle: { is: { model } }, status: BlockingRecordStatus.DELIVERED },
    });
    const expired = await prisma.blockingRequest.count({
      where: { vehicle: { is: { model } }, status: BlockingRecordStatus.EXPIRED },
    });
    const denom = blocks + expired;
    const expiryRate = denom === 0 ? 0 : expired / denom;
    out.push({
      model,
      hardBlocks: blocks,
      delivered,
      expired,
      expiryRate: Math.round(expiryRate * 1000) / 1000,
    });
  }
  out.sort((a, b) => b.hardBlocks - a.hardBlocks);
  res.json(out);
});

export default router;

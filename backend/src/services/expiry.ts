import { BlockingRecordStatus, VehicleStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { broadcastStockUpdate } from "./events.js";
import { writeAudit } from "./audit.js";

const SOFT_MS = 5 * 60 * 1000;

export async function runExpirySweep() {
  const now = new Date();

  const softVictims = await prisma.blockingRequest.findMany({
    where: {
      blockType: "SOFT",
      status: BlockingRecordStatus.ACTIVE,
      softBlockAt: { not: null },
    },
    include: { vehicle: true },
  });

  for (const b of softVictims) {
    const start = b.softBlockAt!.getTime();
    if (now.getTime() - start < SOFT_MS) continue;
    await prisma.$transaction(async (tx) => {
      await tx.blockingRequest.update({
        where: { id: b.id },
        data: { status: BlockingRecordStatus.EXPIRED },
      });
      if (b.vehicle.status === VehicleStatus.SOFT_BLOCKED) {
        await tx.vehicle.update({
          where: { id: b.vehicleId },
          data: { status: VehicleStatus.OPEN },
        });
      }
    });
    await writeAudit({
      entityType: "BLOCKING",
      entityId: b.id,
      action: "EXPIRED",
      performedById: b.userId,
      newValue: { reason: "soft_block_timeout" },
    });
  }

  const hardVictims = await prisma.blockingRequest.findMany({
    where: {
      blockType: "HARD",
      status: BlockingRecordStatus.ACTIVE,
      expiryAt: { lte: now },
    },
    include: { vehicle: true },
  });

  for (const b of hardVictims) {
    await prisma.$transaction(async (tx) => {
      await tx.blockingRequest.update({
        where: { id: b.id },
        data: { status: BlockingRecordStatus.EXPIRED },
      });
      if (
        b.vehicle.status === VehicleStatus.HARD_BLOCKED ||
        b.vehicle.status === VehicleStatus.SOFT_BLOCKED
      ) {
        await tx.vehicle.update({
          where: { id: b.vehicleId },
          data: { status: VehicleStatus.OPEN },
        });
      }
    });
    await writeAudit({
      entityType: "BLOCKING",
      entityId: b.id,
      action: "EXPIRED",
      performedById: b.userId,
      newValue: { reason: "hard_block_expiry" },
    });
  }

  if (softVictims.some((b) => now.getTime() - b.softBlockAt!.getTime() >= SOFT_MS) || hardVictims.length) {
    broadcastStockUpdate();
  }
}

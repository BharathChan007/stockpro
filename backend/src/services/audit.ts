import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function writeAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  performedById: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      performedById: params.performedById,
      previousValue: JSON.stringify(params.previousValue ?? {}),
      newValue: JSON.stringify(params.newValue ?? {}),
    },
  });
}

export async function writeAuditTx(
  tx: Prisma.TransactionClient,
  params: {
    entityType: string;
    entityId: string;
    action: string;
    performedById: string;
    previousValue?: unknown;
    newValue?: unknown;
  }
) {
  await tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      performedById: params.performedById,
      previousValue: JSON.stringify(params.previousValue ?? {}),
      newValue: JSON.stringify(params.newValue ?? {}),
    },
  });
}

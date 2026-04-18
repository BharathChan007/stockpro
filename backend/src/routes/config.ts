import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { writeAudit } from "../services/audit.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/global", async (_req, res) => {
  const g = await prisma.globalConfig.upsert({
    where: { id: 1 },
    create: { id: 1, defaultBlockingDays: 7 },
    update: {},
  });
  res.json(g);
});

const globalSchema = z.object({ defaultBlockingDays: z.number().int().min(1).max(365) });

router.put("/global", async (req: AuthedRequest, res) => {
  const parsed = globalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const prev = await prisma.globalConfig.findUnique({ where: { id: 1 } });
  const g = await prisma.globalConfig.upsert({
    where: { id: 1 },
    create: { id: 1, defaultBlockingDays: parsed.data.defaultBlockingDays },
    update: { defaultBlockingDays: parsed.data.defaultBlockingDays },
  });
  await writeAudit({
    entityType: "CONFIG",
    entityId: "global",
    action: "EDITED",
    performedById: req.auth!.sub,
    previousValue: prev,
    newValue: g,
  });
  res.json(g);
});

router.get("/models", async (_req, res) => {
  const models = await prisma.modelConfig.findMany({ orderBy: { modelName: "asc" } });
  res.json(models);
});

const modelSchema = z.object({ blockingDurationDays: z.number().int().min(1).max(365) });

router.put("/models/:model", async (req: AuthedRequest, res) => {
  const modelName = decodeURIComponent(req.params.model);
  const parsed = modelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const prev = await prisma.modelConfig.findUnique({ where: { modelName } });
  const row = await prisma.modelConfig.upsert({
    where: { modelName },
    create: {
      modelName,
      blockingDurationDays: parsed.data.blockingDurationDays,
      updatedById: req.auth!.sub,
    },
    update: {
      blockingDurationDays: parsed.data.blockingDurationDays,
      updatedById: req.auth!.sub,
    },
  });
  await writeAudit({
    entityType: "CONFIG",
    entityId: row.id,
    action: "EDITED",
    performedById: req.auth!.sub,
    previousValue: prev,
    newValue: row,
  });
  res.json(row);
});

export default router;

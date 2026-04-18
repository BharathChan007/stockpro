import { Router, type Request } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import {
  BlockType,
  BlockingRecordStatus,
  PaymentMode,
  VehicleStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { writeAudit, writeAuditTx } from "../services/audit.js";
import { broadcastStockUpdate } from "../services/events.js";

const router = Router();

const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));

const receiptStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadRoot, { recursive: true });
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

function receiptFilter(_req: Request, file: { mimetype: string }, cb: multer.FileFilterCallback) {
  const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (ok.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only PDF, JPG, PNG allowed."));
}

const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: receiptFilter,
});

async function durationDaysForModel(model: string): Promise<number> {
  const [g, m] = await Promise.all([
    prisma.globalConfig.findUnique({ where: { id: 1 } }),
    prisma.modelConfig.findUnique({ where: { modelName: model } }),
  ]);
  return m?.blockingDurationDays ?? g?.defaultBlockingDays ?? 7;
}

const softSchema = z.object({
  model: z.string().min(1),
  suffix: z.string().min(1),
  colour: z.string().min(1),
});

router.post("/soft", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "SALES_MANAGER") {
    res.status(403).json({ error: "Sales only." });
    return;
  }
  const parsed = softSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const branchId = req.auth!.branchId;
  if (!branchId) {
    res.status(400).json({ error: "Branch missing." });
    return;
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const olds = await tx.blockingRequest.findMany({
        where: {
          userId: req.auth!.sub,
          blockType: BlockType.SOFT,
          status: BlockingRecordStatus.ACTIVE,
        },
        include: { vehicle: true },
      });
      for (const o of olds) {
        await tx.blockingRequest.update({
          where: { id: o.id },
          data: { status: BlockingRecordStatus.EXPIRED },
        });
        if (o.vehicle.status === VehicleStatus.SOFT_BLOCKED) {
          await tx.vehicle.update({
            where: { id: o.vehicleId },
            data: { status: VehicleStatus.OPEN },
          });
        }
      }

      const candidates = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Vehicle"
        WHERE model = ${parsed.data.model}
          AND suffix = ${parsed.data.suffix}
          AND colour = ${parsed.data.colour}
          AND status = ${VehicleStatus.OPEN}::"VehicleStatus"
        ORDER BY "dateOfArrival" ASC
        LIMIT 1
      `;
      if (!candidates.length) return { kind: "NO_STOCK" as const };
      const vid = candidates[0].id;
      const upd = await tx.vehicle.updateMany({
        where: { id: vid, status: VehicleStatus.OPEN },
        data: { status: VehicleStatus.SOFT_BLOCKED },
      });
      if (upd.count !== 1) return { kind: "TAKEN" as const };

      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vid } });
      const softBlockAt = new Date();
      const blocking = await tx.blockingRequest.create({
        data: {
          vehicleId: vehicle.id,
          userId: req.auth!.sub,
          branchId,
          blockType: BlockType.SOFT,
          softBlockAt,
          status: BlockingRecordStatus.ACTIVE,
        },
      });
      await writeAuditTx(tx, {
        entityType: "BLOCKING",
        entityId: blocking.id,
        action: "CREATED",
        performedById: req.auth!.sub,
        newValue: { blockType: "SOFT", vehicleId: vehicle.id },
      });
      return { kind: "OK" as const, blocking, vehicle, softBlockAt };
    });

    if (outcome.kind === "NO_STOCK") {
      res.status(409).json({ error: "No open vehicle for this combination." });
      return;
    }
    if (outcome.kind === "TAKEN") {
      res.status(409).json({
        error: "This vehicle was just taken — please select again.",
      });
      return;
    }

    broadcastStockUpdate();
    const expiresAt = new Date(outcome.softBlockAt.getTime() + 5 * 60 * 1000);
    res.status(201).json({
      blockingId: outcome.blocking.id,
      vehicleId: outcome.vehicle.id,
      chassisYear: outcome.vehicle.chassisYear,
      model: outcome.vehicle.model,
      suffix: outcome.vehicle.suffix,
      colour: outcome.vehicle.colour,
      softBlockAt: outcome.softBlockAt.toISOString(),
      softExpiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const hardFields = z.object({
  blockingId: z.string().uuid(),
  orderId: z.string().min(1),
  customerName: z.string().min(1),
  consultantName: z.string().min(1),
  paymentMode: z.nativeEnum(PaymentMode),
  financierBank: z.string().optional(),
  paymentStatus: z.string().min(1),
  expectedBillingDate: z.string().min(1),
});

router.post(
  "/hard",
  requireAuth,
  uploadReceipt.single("receipt"),
  async (req: AuthedRequest, res) => {
    if (req.auth!.role !== "SALES_MANAGER") {
      res.status(403).json({ error: "Sales only." });
      return;
    }
    const parsed = hardFields.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload." });
      return;
    }
    if (parsed.data.paymentMode === PaymentMode.FINANCE && !parsed.data.financierBank?.trim()) {
      res.status(400).json({ error: "Financier bank required for finance mode." });
      return;
    }

    const blockingId = parsed.data.blockingId;
    const billing = new Date(parsed.data.expectedBillingDate);
    if (Number.isNaN(billing.getTime())) {
      res.status(400).json({ error: "Invalid expected billing date." });
      return;
    }

    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    try {
      const out = await prisma.$transaction(async (tx) => {
        const br = await tx.blockingRequest.findUnique({
          where: { id: blockingId },
          include: { vehicle: true },
        });
        if (!br || br.userId !== req.auth!.sub) {
          return { err: "NOT_FOUND" as const };
        }
        if (br.blockType !== BlockType.SOFT || br.status !== BlockingRecordStatus.ACTIVE) {
          return { err: "INVALID_STATE" as const };
        }
        if (br.vehicle.status !== VehicleStatus.SOFT_BLOCKED) {
          return { err: "INVALID_STATE" as const };
        }
        if (!br.softBlockAt || Date.now() - br.softBlockAt.getTime() > 5 * 60 * 1000) {
          return { err: "SOFT_EXPIRED" as const };
        }

        const days = await durationDaysForModel(br.vehicle.model);
        const hardBlockAt = new Date();
        const expiryAt = new Date(hardBlockAt);
        expiryAt.setDate(expiryAt.getDate() + days);

        await tx.blockingRequest.update({
          where: { id: br.id },
          data: {
            blockType: BlockType.HARD,
            orderId: parsed.data.orderId,
            customerName: parsed.data.customerName,
            consultantName: parsed.data.consultantName,
            paymentMode: parsed.data.paymentMode,
            financierBank: parsed.data.paymentMode === PaymentMode.FINANCE ? parsed.data.financierBank : null,
            paymentStatus: parsed.data.paymentStatus,
            expectedBillingDate: billing,
            receiptUrl,
            hardBlockAt,
            expiryAt,
          },
        });

        await tx.vehicle.update({
          where: { id: br.vehicleId },
          data: { status: VehicleStatus.HARD_BLOCKED },
        });

        await writeAuditTx(tx, {
          entityType: "BLOCKING",
          entityId: br.id,
          action: "HARD_BLOCKED",
          performedById: req.auth!.sub,
          newValue: {
            orderId: parsed.data.orderId,
            expiryAt: expiryAt.toISOString(),
          },
        });

        return {
          ok: true as const,
          expiryAt,
          blockingId: br.id,
          vehicleId: br.vehicleId,
        };
      });

      if ("err" in out) {
        if (out.err === "NOT_FOUND") {
          res.status(404).json({ error: "Blocking not found." });
          return;
        }
        if (out.err === "SOFT_EXPIRED") {
          res.status(409).json({ error: "Soft hold expired — start again." });
          return;
        }
        res.status(409).json({ error: "Invalid blocking state." });
        return;
      }

      broadcastStockUpdate();
      res.status(200).json({
        message: "Vehicle fully blocked.",
        blockingId: out.blockingId,
        vehicleId: out.vehicleId,
        expiryAt: out.expiryAt.toISOString(),
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

router.get("/my", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "SALES_MANAGER") {
    res.status(403).json({ error: "Sales only." });
    return;
  }
  const tab = z.enum(["active", "expired", "delivered"]).safeParse(req.query.tab);
  const t = tab.success ? tab.data : "active";

  const where = {
    userId: req.auth!.sub,
    ...(t === "active"
      ? { status: BlockingRecordStatus.ACTIVE }
      : t === "expired"
        ? { status: BlockingRecordStatus.EXPIRED }
        : { status: BlockingRecordStatus.DELIVERED }),
  };

  const rows = await prisma.blockingRequest.findMany({
    where,
    include: {
      vehicle: true,
      branch: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(rows);
});

const listQuery = z.object({
  branchId: z.string().optional(),
  status: z.nativeEnum(BlockingRecordStatus).optional(),
  model: z.string().optional(),
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.get("/all", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  const q = listQuery.safeParse(req.query);
  const where: Record<string, unknown> = {};
  if (q.success) {
    if (q.data.branchId) where.branchId = q.data.branchId;
    if (q.data.status) where.status = q.data.status;
    if (q.data.model) where.vehicle = { is: { model: { contains: q.data.model } } };
    if (q.data.from || q.data.to) {
      where.hardBlockAt = {};
      if (q.data.from) (where.hardBlockAt as Record<string, Date>).gte = new Date(q.data.from);
      if (q.data.to) (where.hardBlockAt as Record<string, Date>).lte = new Date(q.data.to);
    }
    if (q.data.q) {
      where.OR = [
        { customerName: { contains: q.data.q } },
        { orderId: { contains: q.data.q } },
        { vehicle: { is: { chassisNumber: { contains: q.data.q } } } },
      ];
    }
  }

  const rows = await prisma.blockingRequest.findMany({
    where,
    include: {
      vehicle: true,
      user: { select: { fullName: true, loginId: true } },
      branch: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(rows);
});

router.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const row = await prisma.blockingRequest.findUnique({
    where: { id },
    include: {
      vehicle: true,
      user: { select: { fullName: true, loginId: true } },
      branch: true,
    },
  });
  if (!row) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const isOwner = row.userId === req.auth!.sub;
  const isAdmin = req.auth!.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Forbidden." });
    return;
  }
  res.json(row);
});

const patchSchema = z.object({
  orderId: z.string().optional(),
  customerName: z.string().optional(),
  consultantName: z.string().optional(),
  paymentMode: z.nativeEnum(PaymentMode).optional(),
  financierBank: z.string().nullable().optional(),
  paymentStatus: z.string().optional(),
  expectedBillingDate: z.string().optional(),
  adminNotes: z.string().nullable().optional(),
});

router.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  const id = req.params.id;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const prev = await prisma.blockingRequest.findUnique({ where: { id }, include: { vehicle: true } });
  if (!prev) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const data: Record<string, unknown> = {};
  const p = parsed.data;
  if (p.orderId !== undefined) data.orderId = p.orderId;
  if (p.customerName !== undefined) data.customerName = p.customerName;
  if (p.consultantName !== undefined) data.consultantName = p.consultantName;
  if (p.paymentMode !== undefined) data.paymentMode = p.paymentMode;
  if (p.financierBank !== undefined) data.financierBank = p.financierBank;
  if (p.paymentStatus !== undefined) data.paymentStatus = p.paymentStatus;
  if (p.expectedBillingDate !== undefined) {
    const d = new Date(p.expectedBillingDate);
    if (Number.isNaN(d.getTime())) {
      res.status(400).json({ error: "Invalid date." });
      return;
    }
    data.expectedBillingDate = d;
  }
  if (p.adminNotes !== undefined) data.adminNotes = p.adminNotes;

  const next = await prisma.blockingRequest.update({
    where: { id },
    data,
    include: { vehicle: true, user: true, branch: true },
  });
  await writeAudit({
    entityType: "BLOCKING",
    entityId: id,
    action: "EDITED",
    performedById: req.auth!.sub,
    previousValue: prev,
    newValue: next,
  });
  broadcastStockUpdate();
  res.json(next);
});

const extendSchema = z.object({
  expiryAt: z.string().min(1),
});

router.patch("/:id/extend", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  const id = req.params.id;
  const parsed = extendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const expiryAt = new Date(parsed.data.expiryAt);
  if (Number.isNaN(expiryAt.getTime())) {
    res.status(400).json({ error: "Invalid expiry." });
    return;
  }
  const prev = await prisma.blockingRequest.findUnique({ where: { id } });
  if (!prev) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const next = await prisma.blockingRequest.update({
    where: { id },
    data: { expiryAt, extendedByAdmin: true },
    include: { vehicle: true },
  });
  await writeAudit({
    entityType: "BLOCKING",
    entityId: id,
    action: "EXTENDED",
    performedById: req.auth!.sub,
    previousValue: prev,
    newValue: next,
  });
  broadcastStockUpdate();
  res.json(next);
});

router.patch("/:id/release", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  const id = req.params.id;
  const prev = await prisma.blockingRequest.findUnique({
    where: { id },
    include: { vehicle: true },
  });
  if (!prev) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.blockingRequest.update({
      where: { id },
      data: { status: BlockingRecordStatus.EXPIRED },
    });
    if (
      prev.vehicle.status === VehicleStatus.HARD_BLOCKED ||
      prev.vehicle.status === VehicleStatus.SOFT_BLOCKED
    ) {
      await tx.vehicle.update({
        where: { id: prev.vehicleId },
        data: { status: VehicleStatus.OPEN },
      });
    }
    await writeAuditTx(tx, {
      entityType: "BLOCKING",
      entityId: id,
      action: "RELEASED",
      performedById: req.auth!.sub,
      previousValue: prev,
      newValue: { status: "EXPIRED", manual: true },
    });
  });

  broadcastStockUpdate();
  res.json({ ok: true });
});

const deliverSchema = z.object({
  retailId: z.string().min(1),
});

router.patch(
  "/:id/deliver",
  requireAuth,
  uploadReceipt.single("document"),
  async (req: AuthedRequest, res) => {
    if (req.auth!.role !== "SALES_MANAGER") {
      res.status(403).json({ error: "Sales only." });
      return;
    }
    const id = req.params.id;
    const parsed = deliverSchema.safeParse(req.body);
    if (!parsed.success || !req.file) {
      res.status(400).json({ error: "Retail ID and document required." });
      return;
    }

    const row = await prisma.blockingRequest.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!row || row.userId !== req.auth!.sub) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    if (row.status !== BlockingRecordStatus.ACTIVE || row.blockType !== BlockType.HARD) {
      res.status(409).json({ error: "Only active hard blocks can be delivered." });
      return;
    }

    const docUrl = `/uploads/${req.file.filename}`;
    const deliveredAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.blockingRequest.update({
        where: { id },
        data: {
          status: BlockingRecordStatus.DELIVERED,
          retailId: parsed.data.retailId,
          deliveryDocUrl: docUrl,
          deliveredAt,
        },
      });
      await tx.vehicle.update({
        where: { id: row.vehicleId },
        data: { status: VehicleStatus.DELIVERED },
      });
      await writeAuditTx(tx, {
        entityType: "BLOCKING",
        entityId: id,
        action: "DELIVERED",
        performedById: req.auth!.sub,
        newValue: { retailId: parsed.data.retailId },
      });
    });

    broadcastStockUpdate();
    res.json({ ok: true, deliveredAt: deliveredAt.toISOString() });
  }
);

export default router;

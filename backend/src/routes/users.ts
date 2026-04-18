import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, validatePasswordComplexity } from "../lib/password.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { UserRole } from "@prisma/client";
import { writeAudit } from "../services/audit.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const rows = await prisma.user.findMany({
    include: { branch: true },
    orderBy: { loginId: "asc" },
  });
  res.json(
    rows.map((u) => ({
      id: u.id,
      loginId: u.loginId,
      role: u.role,
      fullName: u.fullName,
      branchId: u.branchId,
      branch: u.branch,
      active: u.active,
      createdAt: u.createdAt,
    }))
  );
});

const createSchema = z.object({
  loginId: z.string().min(3),
  password: z.string().min(10),
  role: z.nativeEnum(UserRole),
  branchId: z.string().uuid().nullable().optional(),
  fullName: z.string().min(1),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const err = validatePasswordComplexity(parsed.data.password);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  if (parsed.data.role === UserRole.SALES_MANAGER && !parsed.data.branchId) {
    res.status(400).json({ error: "Sales managers require a branch." });
    return;
  }
  if (parsed.data.role === UserRole.ADMIN && parsed.data.branchId) {
    res.status(400).json({ error: "Admin users must not have a branch." });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const u = await prisma.user.create({
      data: {
        loginId: parsed.data.loginId,
        passwordHash,
        role: parsed.data.role,
        branchId: parsed.data.role === UserRole.ADMIN ? null : parsed.data.branchId ?? null,
        fullName: parsed.data.fullName,
      },
      include: { branch: true },
    });
    await writeAudit({
      entityType: "USER",
      entityId: u.id,
      action: "CREATED",
      performedById: req.auth!.sub,
      newValue: { loginId: u.loginId, role: u.role },
    });
    res.status(201).json({
      id: u.id,
      loginId: u.loginId,
      role: u.role,
      fullName: u.fullName,
      branchId: u.branchId,
      branch: u.branch,
    });
  } catch {
    res.status(409).json({ error: "Login ID already exists." });
  }
});

const patchSchema = z.object({
  fullName: z.string().optional(),
  branchId: z.string().uuid().nullable().optional(),
  password: z.string().min(10).optional(),
  active: z.boolean().optional(),
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const prev = await prisma.user.findUnique({ where: { id } });
  if (!prev) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const data: {
    fullName?: string;
    branchId?: string | null;
    passwordHash?: string;
    active?: boolean;
  } = {};
  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.branchId !== undefined) data.branchId = parsed.data.branchId;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.password) {
    const err = validatePasswordComplexity(parsed.data.password);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    data.passwordHash = await hashPassword(parsed.data.password);
  }
  const next = await prisma.user.update({
    where: { id },
    data,
    include: { branch: true },
  });
  await writeAudit({
    entityType: "USER",
    entityId: id,
    action: "EDITED",
    performedById: req.auth!.sub,
    previousValue: prev,
    newValue: next,
  });
  res.json(next);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (id === req.auth!.sub) {
    res.status(400).json({ error: "Cannot deactivate yourself." });
    return;
  }
  const prev = await prisma.user.findUnique({ where: { id } });
  if (!prev) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  await prisma.user.update({ where: { id }, data: { active: false } });
  await writeAudit({
    entityType: "USER",
    entityId: id,
    action: "DEACTIVATED",
    performedById: req.auth!.sub,
    previousValue: prev,
    newValue: { active: false },
  });
  res.status(204).send();
});

export default router;

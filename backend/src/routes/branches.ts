import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const rows = await prisma.branch.findMany({ orderBy: { name: "asc" } });
  res.json(rows);
});

const createSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
    return;
  }
  const b = await prisma.branch.create({
    data: {
      name: parsed.data.name,
      location: parsed.data.location ?? "",
    },
  });
  res.status(201).json(b);
});

export default router;

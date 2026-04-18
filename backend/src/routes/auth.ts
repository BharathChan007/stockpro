import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const { loginId, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { loginId },
    include: { branch: true },
  });
  if (!user || !user.active) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }
  const token = signToken({
    sub: user.id,
    role: user.role,
    branchId: user.branchId,
  });
  res.json({
    token,
    user: {
      id: user.id,
      loginId: user.loginId,
      role: user.role,
      fullName: user.fullName,
      branch: user.branch,
    },
  });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    include: { branch: true },
  });
  if (!user || !user.active) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  res.json({
    id: user.id,
    loginId: user.loginId,
    role: user.role,
    fullName: user.fullName,
    branch: user.branch,
  });
});

export default router;

import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";

export type AuthedRequest = Request & { auth?: JwtPayload };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") {
    res.status(403).json({ error: "Admin only." });
    return;
  }
  next();
}

export function requireSales(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== "SALES_MANAGER") {
    res.status(403).json({ error: "Sales portal only." });
    return;
  }
  next();
}

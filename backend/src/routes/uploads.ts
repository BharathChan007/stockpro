import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadRoot, { recursive: true });
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

function allowedMime(m: string | undefined): boolean {
  const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  return !!m && ok.includes(m);
}

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMime(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, JPG, PNG allowed."));
  },
});

const router = Router();

router.use(requireAuth);

router.post("/", upload.single("file"), (req: AuthedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Missing file." });
    return;
  }
  const publicPath = `/uploads/${req.file.filename}`;
  res.json({ url: publicPath });
});

export default router;

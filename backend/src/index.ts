import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import http from "node:http";
import cron from "node-cron";
import { Server as IoServer } from "socket.io";

import authRoutes from "./routes/auth.js";
import stockRoutes from "./routes/stock.js";
import blockingRoutes from "./routes/blocking.js";
import analyticsRoutes from "./routes/analytics.js";
import configRoutes from "./routes/config.js";
import usersRoutes from "./routes/users.js";
import branchesRoutes from "./routes/branches.js";
import uploadsRoutes from "./routes/uploads.js";
import { setIo } from "./services/events.js";
import { runExpirySweep } from "./services/expiry.js";

const app = express();
const server = http.createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const io = new IoServer(server, {
  cors: { origin: clientOrigin, methods: ["GET", "POST"] },
});
setIo(io);

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.join(process.cwd(), "tmp"), { recursive: true });
app.use("/uploads", express.static(uploadDir));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/stock", stockRoutes);
app.use("/blocking", blockingRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/config", configRoutes);
app.use("/users", usersRoutes);
app.use("/branches", branchesRoutes);
app.use("/files", uploadsRoutes);

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

cron.schedule("* * * * *", () => {
  runExpirySweep().catch((e) => console.error("Expiry sweep failed", e));
});

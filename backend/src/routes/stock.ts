import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import * as XLSX from "xlsx";
import { VehicleStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { countToLevel } from "../lib/heatmap.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { writeAudit } from "../services/audit.js";
import { broadcastStockUpdate } from "../services/events.js";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "tmp") });

const listQuery = z.object({
  model: z.string().optional(),
  status: z.nativeEnum(VehicleStatus).optional(),
  q: z.string().optional(),
});

function cellVal(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "")
      return String(row[k]).trim();
  }
  return "";
}

function cellInt(row: Record<string, unknown>, keys: string[], d: number): number {
  const s = cellVal(row, keys);
  if (!s) return d;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : d;
}

/** Parse arrival as Excel serial or ISO/string date */
function cellDate(row: Record<string, unknown>, keys: string[]): Date {
  const raw = cellVal(row, keys);
  if (!raw) return new Date();
  const n = Number(raw);
  if (!Number.isNaN(n) && n > 20000 && n < 90000) {
    const utc = Math.round((n - 25569) * 86400 * 1000);
    return new Date(utc);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

router.get("/heatmap", requireAuth, async (_req: AuthedRequest, res) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: VehicleStatus.OPEN },
    select: { model: true, suffix: true, colour: true },
  });
  const counts = new Map<string, number>();
  for (const v of vehicles) {
    const key = `${v.model}\u001f${v.suffix}\u001f${v.colour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const cells = [...counts.entries()].map(([key, openCount]) => {
    const [model, suffix, colour] = key.split("\u001f");
    return {
      model,
      suffix,
      colour,
      level: countToLevel(openCount),
    };
  });
  /** Include known combos with zero open stock as none */
  const combos = await prisma.vehicle.groupBy({
    by: ["model", "suffix", "colour"],
    _count: { _all: true },
  });
  const keysSeen = new Set(counts.keys());
  for (const c of combos) {
    const key = `${c.model}\u001f${c.suffix}\u001f${c.colour}`;
    if (!keysSeen.has(key)) {
      cells.push({
        model: c.model,
        suffix: c.suffix,
        colour: c.colour,
        level: countToLevel(0),
      });
    }
  }
  res.json({
    cells,
    updatedAt: new Date().toISOString(),
  });
});

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const q = listQuery.safeParse(req.query);
  const where: Record<string, unknown> = {};
  if (q.success && q.data.model) where.model = q.data.model;
  if (q.success && q.data.status) where.status = q.data.status;
  if (q.success && q.data.q) {
    where.OR = [
      { chassisNumber: { contains: q.data.q } },
      { model: { contains: q.data.q } },
    ];
  }
  const rows = await prisma.vehicle.findMany({
    where,
    orderBy: [{ model: "asc" }, { suffix: "asc" }],
    include: {
      blockings: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          user: { select: { fullName: true, loginId: true } },
        },
      },
    },
  });
  res.json(rows);
});

router.post("/import", requireAuth, requireAdmin, upload.single("file"), async (req: AuthedRequest, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Missing file." });
    return;
  }
  try {
    const buf = fs.readFileSync(file.path);
    fs.unlinkSync(file.path);
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    let ok = 0;
    let rejected = 0;
    const errors: string[] = [];
    for (let i = 0; i < json.length; i++) {
      const row = json[i];
      const chassisNumber = cellVal(row, [
        "Chassis Number",
        "chassis_number",
        "ChassisNumber",
        "chassisNumber",
      ]);
      if (!chassisNumber) {
        rejected++;
        errors.push(`Row ${i + 2}: missing chassis number`);
        continue;
      }
      const chassisYear = cellInt(row, ["Chassis Year", "chassis_year", "ChassisYear"], new Date().getFullYear());
      const model = cellVal(row, ["Model", "model"]);
      const suffix = cellVal(row, ["Suffix / Variant", "Suffix", "suffix"]);
      const colour = cellVal(row, ["Colour", "Colour ", "colour"]);
      const stockyardLocation = cellVal(row, ["Stockyard Location", "stockyard_location"]);
      const dateOfArrival = cellDate(row, ["Date of Arrival", "date_of_arrival"]);

      if (!model || !suffix || !colour) {
        rejected++;
        errors.push(`Row ${i + 2}: missing model/suffix/colour`);
        continue;
      }

      try {
        await prisma.vehicle.upsert({
          where: { chassisNumber },
          create: {
            chassisNumber,
            chassisYear,
            model,
            suffix,
            colour,
            stockyardLocation,
            dateOfArrival,
            status: VehicleStatus.OPEN,
          },
          update: {
            chassisYear,
            model,
            suffix,
            colour,
            stockyardLocation,
            dateOfArrival,
          },
        });
        ok++;
      } catch {
        rejected++;
        errors.push(`Row ${i + 2}: could not upsert chassis ${chassisNumber}`);
      }
    }
    await writeAudit({
      entityType: "VEHICLE",
      entityId: "import",
      action: "IMPORT",
      performedById: req.auth!.sub,
      newValue: { ok, rejected, total: json.length },
    });
    broadcastStockUpdate();
    res.json({
      totalRows: json.length,
      successfulImports: ok,
      rejectedRows: rejected,
      errors: errors.slice(0, 50),
    });
  } catch (e) {
    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(400).json({ error: String(e) });
  }
});

router.get("/export", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await prisma.vehicle.findMany({
    orderBy: [{ model: "asc" }, { chassisNumber: "asc" }],
    include: {
      blockings: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          user: true,
          branch: true,
        },
      },
    },
  });
  const data = rows.map((v) => {
    const b = v.blockings[0];
    return {
      chassis_number: v.chassisNumber,
      chassis_year: v.chassisYear,
      model: v.model,
      suffix: v.suffix,
      colour: v.colour,
      stockyard_location: v.stockyardLocation,
      date_of_arrival: v.dateOfArrival.toISOString().slice(0, 10),
      status: v.status,
      blocked_by: b?.user.fullName ?? "",
      blocking_expiry: b?.expiryAt?.toISOString() ?? "",
      branch: b?.branch.name ?? "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "stock");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=stock_export.xlsx");
  res.send(buf);
});

export default router;

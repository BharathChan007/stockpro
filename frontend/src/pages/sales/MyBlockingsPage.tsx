import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";

type Vehicle = {
  chassisNumber: string;
  chassisYear: number;
  model: string;
  suffix: string;
  colour: string;
};

type BlockingRow = {
  id: string;
  blockType: string;
  status: string;
  vehicle: Vehicle;
  customerName: string;
  consultantName: string;
  paymentStatus: string;
  expectedBillingDate: string | null;
  expiryAt: string | null;
  hardBlockAt: string | null;
  orderId: string;
};

function urgency(expiryAt: string | null): "green" | "yellow" | "red" {
  if (!expiryAt) return "green";
  const ms = new Date(expiryAt).getTime() - Date.now();
  const days = ms / (86400000);
  if (days > 3) return "green";
  if (days >= 1) return "yellow";
  return "red";
}

function fmtEta(expiryAt: string | null): string {
  if (!expiryAt) return "—";
  const ms = new Date(expiryAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = ms / 3600000;
  if (hours < 24) return `Expires in ${Math.ceil(hours)} hours`;
  const days = Math.ceil(ms / 86400000);
  return `Expires in ${days} days`;
}

export default function MyBlockingsPage() {
  const [tab, setTab] = useState<"active" | "expired" | "delivered">("active");
  const [rows, setRows] = useState<BlockingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BlockingRow | null>(null);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [retailId, setRetailId] = useState("");
  const [doc, setDoc] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<BlockingRow[]>(`/blocking/my?tab=${tab}`);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }

  useEffect(() => {
    load();
  }, [tab]);

  async function submitDeliver(e: FormEvent) {
    e.preventDefault();
    if (!detail || !doc) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("retailId", retailId.trim());
      fd.append("document", doc);
      await api(`/blocking/${detail.id}/deliver`, {
        method: "PATCH",
        body: fd,
      });
      setDeliverOpen(false);
      setDetail(null);
      setRetailId("");
      setDoc(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delivery failed.");
    } finally {
      setBusy(false);
    }
  }

  const heading = useMemo(() => {
    if (tab === "active") return "Active blockings";
    if (tab === "expired") return "Expired blockings";
    return "Delivered vehicles";
  }, [tab]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-on-surface">{heading}</h2>
          <p className="font-body text-sm text-on-surface-variant mt-1">Your reservations and outcomes.</p>
        </div>
        <div className="flex gap-2 bg-surface-container-low p-1 rounded-lg ring-1 ring-outline-variant/10">
          {(["active", "expired", "delivered"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "px-4 py-2 rounded-md font-label text-[10px] uppercase tracking-widest",
                tab === t ? "bg-primary-container text-on-primary" : "text-on-surface-variant hover:text-primary",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-tertiary-container/15 px-4 py-3 font-label text-xs text-tertiary ring-1 ring-tertiary-container/25">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {rows.map((r) => {
          const u = urgency(r.expiryAt);
          const ring =
            u === "green"
              ? "ring-primary/40 shadow-primary/10"
              : u === "yellow"
                ? "ring-amber-400/40 shadow-amber-400/10"
                : "ring-tertiary-container/60 shadow-tertiary-container/15";
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setDetail(r)}
              className={`text-left bg-surface-container-low rounded-xl p-6 ring-1 ${ring} hover:bg-surface-container transition-colors`}
            >
              <div className="flex justify-between gap-4 items-start">
                <div>
                  <p className="font-headline text-lg font-semibold text-on-surface">
                    {r.vehicle.model} · {r.vehicle.suffix}
                  </p>
                  <p className="font-body text-xs text-on-surface-variant mt-1">{r.vehicle.colour}</p>
                </div>
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">{r.blockType}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-body text-on-surface-variant">
                <div>
                  <span className="font-label block text-[9px] uppercase tracking-wider text-on-surface-variant/80">Customer</span>
                  {r.customerName || "—"}
                </div>
                <div>
                  <span className="font-label block text-[9px] uppercase tracking-wider text-on-surface-variant/80">Consultant</span>
                  {r.consultantName || "—"}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-label text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-surface-container-high text-on-surface-variant">
                  {r.paymentStatus || "Payment"}
                </span>
                <span className={`font-headline text-sm ${u === "red" ? "text-tertiary" : u === "yellow" ? "text-amber-300" : "text-primary"}`}>
                  {fmtEta(r.expiryAt)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl bg-surface-container-low px-6 py-12 text-center font-body text-sm text-on-surface-variant ring-1 ring-outline-variant/10">
          Nothing in this tab yet.
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-xl w-full bg-surface-container-low rounded-xl ring-1 ring-outline-variant/15 p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between gap-4 items-start">
              <div>
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Blocking detail</p>
                <h3 className="font-headline text-xl font-bold text-primary uppercase tracking-tight mt-1">
                  {detail.vehicle.model}
                </h3>
              </div>
              <button
                type="button"
                className="material-symbols-outlined text-on-surface-variant hover:text-primary"
                onClick={() => setDetail(null)}
              >
                close
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-4 font-body text-xs text-on-surface-variant">
              <div>
                <dt className="font-label uppercase text-[9px] tracking-wider text-on-surface-variant/70">Chassis</dt>
                <dd className="text-on-surface mt-1">{detail.vehicle.chassisNumber}</dd>
              </div>
              <div>
                <dt className="font-label uppercase text-[9px] tracking-wider text-on-surface-variant/70">Year</dt>
                <dd className="text-on-surface mt-1">{detail.vehicle.chassisYear}</dd>
              </div>
              <div>
                <dt className="font-label uppercase text-[9px] tracking-wider text-on-surface-variant/70">Order ID</dt>
                <dd className="text-on-surface mt-1">{detail.orderId || "—"}</dd>
              </div>
              <div>
                <dt className="font-label uppercase text-[9px] tracking-wider text-on-surface-variant/70">Billing date</dt>
                <dd className="text-on-surface mt-1">
                  {detail.expectedBillingDate ? new Date(detail.expectedBillingDate).toLocaleDateString() : "—"}
                </dd>
              </div>
            </dl>

            {tab === "active" && detail.blockType === "HARD" && (
              <button
                type="button"
                onClick={() => {
                  setDeliverOpen(true);
                  setRetailId("");
                  setDoc(null);
                }}
                className="w-full py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline text-xs uppercase tracking-widest"
              >
                Mark as delivered
              </button>
            )}
          </div>
        </div>
      )}

      {deliverOpen && detail && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={submitDeliver} className="max-w-md w-full bg-surface-container rounded-xl ring-1 ring-outline-variant/20 p-8 space-y-6">
            <h4 className="font-headline text-lg uppercase text-primary">Delivery confirmation</h4>
            <label className="block space-y-2">
              <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Retail ID</span>
              <input
                required
                className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                value={retailId}
                onChange={(e) => setRetailId(e.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Delivery document</span>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="block w-full text-xs font-label text-on-surface-variant file:mr-4 file:rounded-lg file:border-0 file:bg-primary-container file:px-4 file:py-2 file:font-headline file:text-xs file:uppercase file:text-on-primary"
                onChange={(e) => setDoc(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="px-5 py-3 rounded-lg bg-surface-container-high font-label text-xs uppercase tracking-wider text-on-surface"
                onClick={() => setDeliverOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-6 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container font-headline text-xs uppercase tracking-widest text-on-primary disabled:opacity-40"
              >
                {busy ? "Saving…" : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

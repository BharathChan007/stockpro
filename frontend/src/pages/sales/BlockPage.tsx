import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";

type Cell = { model: string; suffix: string; colour: string; level: string };
type HeatmapResponse = { cells: Cell[] };

type SoftResponse = {
  blockingId: string;
  vehicleId: string;
  chassisYear: number;
  model: string;
  suffix: string;
  colour: string;
  softBlockAt: string;
  softExpiresAt: string;
};

export default function BlockPage() {
  const [cells, setCells] = useState<Cell[]>([]);
  const [model, setModel] = useState("");
  const [suffix, setSuffix] = useState("");
  const [colour, setColour] = useState("");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [soft, setSoft] = useState<SoftResponse | null>(null);
  const [remainMs, setRemainMs] = useState(0);
  const [warn1m, setWarn1m] = useState(false);

  const [orderId, setOrderId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "FINANCE">("CASH");
  const [financierBank, setFinancierBank] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Pending");
  const [expectedBillingDate, setExpectedBillingDate] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<HeatmapResponse>("/stock/heatmap").then((h) => setCells(h.cells)).catch(() => {});
  }, []);

  const models = useMemo(() => [...new Set(cells.map((c) => c.model))].sort(), [cells]);
  const suffixes = useMemo(() => {
    if (!model) return [];
    return [...new Set(cells.filter((c) => c.model === model).map((c) => c.suffix))].sort();
  }, [cells, model]);
  const colours = useMemo(() => {
    if (!model || !suffix) return [];
    return [...new Set(cells.filter((c) => c.model === model && c.suffix === suffix).map((c) => c.colour))].sort();
  }, [cells, model, suffix]);

  useEffect(() => {
    setSuffix("");
    setColour("");
  }, [model]);

  useEffect(() => {
    setColour("");
  }, [suffix]);

  useEffect(() => {
    if (!soft?.softExpiresAt) return;
    const end = new Date(soft.softExpiresAt).getTime();
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      setRemainMs(ms);
      setWarn1m(ms > 0 && ms <= 60 * 1000);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [soft]);

  async function startSoft() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<SoftResponse>("/blocking/soft", {
        method: "POST",
        body: JSON.stringify({ model, suffix, colour }),
      });
      setSoft(res);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not soft-block.");
    } finally {
      setBusy(false);
    }
  }

  async function submitHard(e: FormEvent) {
    e.preventDefault();
    if (!soft) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("blockingId", soft.blockingId);
      fd.append("orderId", orderId.trim());
      fd.append("customerName", customerName.trim());
      fd.append("consultantName", consultantName.trim());
      fd.append("paymentMode", paymentMode);
      if (paymentMode === "FINANCE") fd.append("financierBank", financierBank.trim());
      fd.append("paymentStatus", paymentStatus);
      fd.append("expectedBillingDate", expectedBillingDate);
      if (receipt) fd.append("receipt", receipt);

      await api("/blocking/hard", {
        method: "POST",
        body: fd,
      });

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  const mmSs = `${String(Math.floor(remainMs / 60000)).padStart(2, "0")}:${String(Math.floor((remainMs % 60000) / 1000)).padStart(2, "0")}`;
  const requiredOk =
    orderId.trim() &&
    customerName.trim() &&
    consultantName.trim() &&
    paymentStatus &&
    expectedBillingDate &&
    (paymentMode === "CASH" || financierBank.trim());

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-on-surface">Reserve Vehicle</h2>
          <p className="font-body text-sm text-on-surface-variant mt-1">Atomic soft hold → hard block protocol.</p>
        </div>
        <Link to="/sales/dashboard" className="font-label text-xs uppercase tracking-wider text-primary hover:text-on-surface">
          ← Back to heatmap
        </Link>
      </div>

      {warn1m && step === 2 && (
        <div className="rounded-xl bg-tertiary-container/20 px-4 py-3 font-label text-xs text-tertiary ring-1 ring-tertiary-container/40 animate-pulse">
          Under one minute remaining — finalize the blocking form now.
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-tertiary-container/15 px-4 py-3 font-label text-xs text-tertiary ring-1 ring-tertiary-container/25">{error}</div>
      )}

      {step === 1 && (
        <section className="bg-surface-container-low rounded-xl p-8 ring-1 ring-outline-variant/10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <label className="space-y-2 block">
              <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Model</span>
              <select
                className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="">Select model</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 block">
              <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Suffix</span>
              <select
                className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                disabled={!model}
              >
                <option value="">Select suffix</option>
                {suffixes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 block">
              <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Colour</span>
              <select
                className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                disabled={!suffix}
              >
                <option value="">Select colour</option>
                {colours.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            disabled={!model || !suffix || !colour || busy}
            onClick={startSoft}
            className="w-full md:w-auto px-10 py-4 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold uppercase tracking-widest text-xs shadow-xl shadow-primary/25 disabled:opacity-40"
          >
            {busy ? "Locking vehicle…" : "Place 5-minute hold"}
          </button>
        </section>
      )}

      {step === 2 && soft && (
        <>
          <header className="sticky top-0 z-20 bg-surface/85 backdrop-blur-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 ring-1 ring-outline-variant/10 rounded-xl">
            <div>
              <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Soft hold</p>
              <p className="font-headline text-lg uppercase text-primary">{soft.model}</p>
            </div>
            <div className="flex items-center gap-3 bg-tertiary-container/10 px-5 py-2 rounded-xl ring-1 ring-tertiary-container/25">
              <div className="text-right">
                <span className="font-label text-[9px] uppercase tracking-widest text-tertiary font-bold block">Expires In</span>
                <span className="font-headline text-3xl font-bold text-tertiary timer-glow leading-none">{mmSs}</span>
              </div>
              <span className="material-symbols-outlined text-tertiary animate-pulse">timer</span>
            </div>
          </header>

          <form onSubmit={submitHard} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <section className="bg-surface-container-low p-6 rounded-xl space-y-6 ring-1 ring-outline-variant/10">
                <div className="flex justify-between items-end pb-4 ring-1 ring-outline-variant/10 ring-inset rounded-lg p-4 -m-2">
                  <h2 className="font-headline text-lg font-semibold tracking-tight text-on-surface">Vehicle (locked)</h2>
                  <span className="font-label text-xs text-primary bg-primary/10 px-2 py-0.5 rounded uppercase font-semibold">Telemetry</span>
                </div>
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Chassis Year</span>
                    <p className="font-headline font-medium text-lg">{soft.chassisYear}</p>
                  </div>
                  <div className="opacity-70">
                    <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Model</span>
                    <p className="font-headline font-medium text-lg">{soft.model}</p>
                  </div>
                  <div className="opacity-70">
                    <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Suffix</span>
                    <p className="font-headline font-medium text-lg">{soft.suffix}</p>
                  </div>
                  <div className="opacity-70">
                    <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Colour</span>
                    <p className="font-headline font-medium text-lg">{soft.colour}</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <h2 className="font-headline text-lg font-semibold tracking-tight text-on-surface px-1">Deal details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="space-y-2">
                  <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Order ID</span>
                  <input
                    required
                    className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Customer name</span>
                  <input
                    required
                    className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Sales consultant</span>
                  <input
                    required
                    className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                    value={consultantName}
                    onChange={(e) => setConsultantName(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <label className="space-y-2">
                  <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Cash / Finance</span>
                  <select
                    className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as "CASH" | "FINANCE")}
                  >
                    <option value="CASH">CASH</option>
                    <option value="FINANCE">FINANCE</option>
                  </select>
                </label>
                {paymentMode === "FINANCE" && (
                  <label className="space-y-2">
                    <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Financier bank</span>
                    <input
                      required
                      className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                      value={financierBank}
                      onChange={(e) => setFinancierBank(e.target.value)}
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="space-y-2">
                  <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Payment status</span>
                  <select
                    className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option>Pending</option>
                    <option>Token Paid</option>
                    <option>Full Payment Done</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Expected billing date</span>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                    value={expectedBillingDate}
                    onChange={(e) => setExpectedBillingDate(e.target.value)}
                  />
                </label>
              </div>

              <label className="space-y-2 block">
                <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Receipt upload (optional)</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="block w-full text-xs font-label text-on-surface-variant file:mr-4 file:rounded-lg file:border-0 file:bg-primary-container file:px-4 file:py-2 file:font-headline file:text-xs file:uppercase file:text-on-primary"
                  onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                />
              </label>

              <button
                type="submit"
                disabled={!requiredOk || busy || remainMs <= 0}
                className="w-full md:w-auto px-12 py-4 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold uppercase tracking-widest text-xs shadow-xl shadow-primary/30 disabled:opacity-40"
              >
                {busy ? "Submitting…" : "Confirm hard block"}
              </button>
            </div>
          </form>
        </>
      )}

      {step === 3 && (
        <section className="bg-surface-container-low rounded-xl p-10 text-center space-y-4 ring-1 ring-outline-variant/10">
          <h3 className="font-headline text-2xl font-bold text-primary uppercase tracking-tight">Blocking confirmed</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Vehicle removed from the open pool for all branches. Monitor expiry in{" "}
            <Link className="text-primary font-semibold" to="/sales/blockings">
              My Blockings
            </Link>
            .
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link
              to="/sales/dashboard"
              className="px-8 py-3 rounded-lg bg-surface-container-high font-headline text-xs uppercase tracking-widest text-on-surface ring-1 ring-outline-variant/20"
            >
              Return to dashboard
            </Link>
            <Link
              to="/sales/block"
              className="px-8 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container font-headline text-xs uppercase tracking-widest text-on-primary"
            >
              Block another
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

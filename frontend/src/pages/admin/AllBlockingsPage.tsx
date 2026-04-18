import { useEffect, useState } from "react";
import { api } from "../../api.js";

type Row = {
  id: string;
  blockType: string;
  status: string;
  customerName: string;
  orderId: string;
  expiryAt: string | null;
  branch: { name: string };
  user: { fullName: string };
  vehicle: { chassisNumber: string; model: string; suffix: string; colour: string };
};

export default function AllBlockingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    const data = await api<Row[]>(`/blocking/all?${qs.toString()}`);
    setRows(data);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function release(id: string) {
    if (!confirm("Release this vehicle back to OPEN pool?")) return;
    setBusyId(id);
    try {
      await api(`/blocking/${id}/release`, { method: "PATCH" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-on-surface">All blockings</h2>
        <p className="font-body text-sm text-on-surface-variant mt-1">Cross-branch reservations.</p>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <input
          placeholder="Search customer, chassis, order ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[220px] rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
        />
        <button
          type="button"
          onClick={() => load()}
          className="px-6 py-3 rounded-lg bg-primary-container text-on-primary font-headline text-xs uppercase tracking-widest"
        >
          Search
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-outline-variant/10 bg-surface-container-low">
        <table className="min-w-full text-left text-[11px] font-body">
          <thead className="font-label uppercase tracking-widest text-[9px] text-on-surface-variant border-b border-outline-variant/15">
            <tr>
              <th className="px-3 py-3">Branch</th>
              <th className="px-3 py-3">Sales</th>
              <th className="px-3 py-3">Vehicle</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Expiry</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant/10 hover:bg-surface-container-high/40 align-top">
                <td className="px-3 py-3">{r.branch.name}</td>
                <td className="px-3 py-3">{r.user.fullName}</td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-on-surface">{r.vehicle.model}</div>
                  <div className="text-on-surface-variant">{r.vehicle.chassisNumber}</div>
                </td>
                <td className="px-3 py-3">{r.customerName}</td>
                <td className="px-3 py-3 uppercase font-label">{r.blockType}</td>
                <td className="px-3 py-3 uppercase font-label">{r.status}</td>
                <td className="px-3 py-3">{r.expiryAt ? new Date(r.expiryAt).toLocaleString() : "—"}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    disabled={busyId === r.id || r.status !== "ACTIVE"}
                    onClick={() => release(r.id)}
                    className="font-label uppercase text-[9px] tracking-wider text-tertiary hover:text-primary disabled:opacity-30"
                  >
                    Release
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

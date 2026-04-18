import { FormEvent, useEffect, useState } from "react";
import { api, getToken } from "../../api.js";

type VehicleRow = {
  id: string;
  chassisNumber: string;
  chassisYear: number;
  model: string;
  suffix: string;
  colour: string;
  status: string;
};

export default function StockAdminPage() {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const data = await api<VehicleRow[]>("/stock");
    setRows(data);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function onImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    if (!file?.size) return;
    setBusy(true);
    setMsg(null);
    try {
      const upload = new FormData();
      upload.append("file", file);
      const res = await api<{
        totalRows: number;
        successfulImports: number;
        rejectedRows: number;
        errors: string[];
      }>("/stock/import", {
        method: "POST",
        body: upload,
      });
      setMsg(
        `Imported ${res.successfulImports} of ${res.totalRows}. Rejected ${res.rejectedRows}.`
      );
      e.currentTarget.reset();
      await refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-on-surface">Stock management</h2>
        <p className="font-body text-sm text-on-surface-variant mt-1">CSV / Excel upsert by chassis number.</p>
      </div>

      <section className="bg-surface-container-low rounded-xl p-8 ring-1 ring-outline-variant/10 space-y-6">
        <form onSubmit={onImport} className="space-y-4">
          <label className="block space-y-2">
            <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Upload file</span>
            <input
              name="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              required
              className="block w-full text-xs font-label text-on-surface-variant file:mr-4 file:rounded-lg file:border-0 file:bg-primary-container file:px-4 file:py-2 file:font-headline file:text-xs file:uppercase file:text-on-primary"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="px-8 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container font-headline text-xs uppercase tracking-widest text-on-primary disabled:opacity-40"
          >
            {busy ? "Importing…" : "Run import"}
          </button>
        </form>
        {msg && <p className="font-body text-xs text-primary">{msg}</p>}
        <button
          type="button"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-surface-container-high font-headline text-xs uppercase tracking-widest text-on-surface ring-1 ring-outline-variant/15"
          onClick={async () => {
            const token = getToken();
            const res = await fetch("/stock/export", {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "stock_export.xlsx";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <span className="material-symbols-outlined text-base">download</span>
          Download Excel export
        </button>
      </section>

      <div className="overflow-x-auto rounded-xl ring-1 ring-outline-variant/10 bg-surface-container-low">
        <table className="min-w-full text-left text-xs font-body">
          <thead className="font-label uppercase tracking-widest text-[10px] text-on-surface-variant border-b border-outline-variant/15">
            <tr>
              <th className="px-4 py-3">Chassis</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Suffix</th>
              <th className="px-4 py-3">Colour</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-b border-outline-variant/10 hover:bg-surface-container-high/40">
                <td className="px-4 py-3 font-mono text-[11px]">{v.chassisNumber}</td>
                <td className="px-4 py-3">{v.model}</td>
                <td className="px-4 py-3">{v.suffix}</td>
                <td className="px-4 py-3">{v.colour}</td>
                <td className="px-4 py-3 font-label uppercase tracking-wide">{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

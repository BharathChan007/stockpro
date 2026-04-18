import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { getSocket } from "../../socket.js";

type Cell = {
  model: string;
  suffix: string;
  colour: string;
  level: "high" | "medium" | "low" | "none";
};

type HeatmapResponse = { cells: Cell[]; updatedAt: string };

function levelBg(level: Cell["level"]) {
  switch (level) {
    case "high":
      return "bg-primary shadow-lg shadow-primary/25";
    case "medium":
      return "bg-amber-400/85 shadow-lg shadow-amber-400/15";
    case "low":
      return "bg-tertiary-container shadow-lg shadow-tertiary-container/30";
    default:
      return "bg-surface-container-highest/55";
  }
}

export default function HeatmapPage() {
  const [cells, setCells] = useState<Cell[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<HeatmapResponse>("/stock/heatmap");
      setCells(data.cells);
      setUpdatedAt(data.updatedAt);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load heatmap.");
    }
  }

  useEffect(() => {
    load();
    const s = getSocket();
    const onUp = () => load();
    s.on("stock:update", onUp);
    const id = window.setInterval(load, 15000);
    return () => {
      s.off("stock:update", onUp);
      window.clearInterval(id);
    };
  }, []);

  const grouped = useMemo(() => {
    const byModel = new Map<string, Map<string, Cell[]>>();
    for (const c of cells) {
      if (!byModel.has(c.model)) byModel.set(c.model, new Map());
      const bySuf = byModel.get(c.model)!;
      if (!bySuf.has(c.suffix)) bySuf.set(c.suffix, []);
      bySuf.get(c.suffix)!.push(c);
    }
    return byModel;
  }, [cells]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Stock Overview</h2>
          <p className="text-on-surface-variant font-body text-sm tracking-tight">
            Availability by Model → Suffix → Colour. Bands only — no unit counts.
          </p>
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mt-2">
            Last sync: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
          </p>
        </div>
        <Link
          to="/sales/block"
          className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-md bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold uppercase tracking-widest text-sm shadow-xl shadow-primary/25 hover:brightness-110 active:scale-[0.99]"
        >
          <span className="material-symbols-outlined group-hover:rotate-90 transition-transform duration-500">add_box</span>
          Block a Vehicle
        </Link>
      </section>

      <section className="flex flex-wrap items-center gap-6 py-4 bg-surface-container-low px-6 rounded-xl ring-1 ring-outline-variant/10">
        <span className="font-label text-[10px] uppercase font-semibold text-on-surface-variant tracking-wider">Legend</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-primary shadow shadow-primary/30" />
          <span className="font-label text-xs text-on-surface-variant">High</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-amber-400/85" />
          <span className="font-label text-xs text-on-surface-variant">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-tertiary-container" />
          <span className="font-label text-xs text-on-surface-variant">Low</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-surface-container-highest/55" />
          <span className="font-label text-xs text-on-surface-variant">None</span>
        </div>
      </section>

      {error && (
        <div className="rounded-xl bg-tertiary-container/15 px-4 py-3 font-label text-xs text-tertiary ring-1 ring-tertiary-container/25">{error}</div>
      )}

      <div className="space-y-10">
        {[...grouped.entries()].map(([model, suffixMap]) => (
          <section key={model} className="space-y-4">
            <h3 className="font-headline text-xl font-semibold tracking-tight text-primary uppercase">{model}</h3>
            <div className="space-y-6">
              {[...suffixMap.entries()].map(([suffix, cols]) => (
                <div key={suffix} className="bg-surface-container-low/80 p-5 rounded-xl ring-1 ring-outline-variant/10 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Suffix</span>
                    <span className="font-headline text-sm font-semibold text-on-surface">{suffix}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {cols.map((c) => (
                      <div key={c.colour} className={`rounded-lg p-4 min-h-[88px] flex flex-col justify-between gap-3 ${levelBg(c.level)}`}>
                        <span className="font-label text-[10px] uppercase tracking-wider text-zinc-950/80 mix-blend-plus-lighter">Colour</span>
                        <span className="font-headline text-sm font-bold text-zinc-950 leading-tight drop-shadow-sm">{c.colour}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

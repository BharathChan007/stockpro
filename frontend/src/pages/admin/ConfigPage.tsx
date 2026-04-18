import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api.js";

type ModelRow = {
  modelName: string;
  blockingDurationDays: number;
};

export default function ConfigPage() {
  const [globalDays, setGlobalDays] = useState(7);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [g, m] = await Promise.all([
      api<{ defaultBlockingDays: number }>("/config/global"),
      api<ModelRow[]>("/config/models"),
    ]);
    setGlobalDays(g.defaultBlockingDays);
    setModels(m);
    const d: Record<string, number> = {};
    for (const row of m) d[row.modelName] = row.blockingDurationDays;
    setDrafts(d);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function saveGlobal(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await api("/config/global", {
      method: "PUT",
      body: JSON.stringify({ defaultBlockingDays: globalDays }),
    });
    setMsg("Global default saved.");
  }

  async function saveModel(modelName: string) {
    setMsg(null);
    const blockingDurationDays = drafts[modelName];
    await api(`/config/models/${encodeURIComponent(modelName)}`, {
      method: "PUT",
      body: JSON.stringify({ blockingDurationDays }),
    });
    setMsg(`Saved ${modelName}.`);
  }

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-on-surface">Blocking configuration</h2>
        <p className="font-body text-sm text-on-surface-variant mt-1">Per-model durations override the global baseline for new hard blocks.</p>
      </div>

      <form onSubmit={saveGlobal} className="bg-surface-container-low rounded-xl p-8 ring-1 ring-outline-variant/10 space-y-4">
        <label className="block space-y-2">
          <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Global default (days)</span>
          <input
            type="number"
            min={1}
            max={365}
            className="w-40 rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
            value={globalDays}
            onChange={(e) => setGlobalDays(Number(e.target.value))}
          />
        </label>
        <button
          type="submit"
          className="px-6 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container font-headline text-xs uppercase tracking-widest text-on-primary"
        >
          Save global default
        </button>
      </form>

      <section className="space-y-4">
        <h3 className="font-headline text-lg text-primary uppercase">Models</h3>
        <div className="space-y-4">
          {models.map((m) => (
            <div key={m.modelName} className="flex flex-wrap gap-4 items-center bg-surface-container-low rounded-xl px-6 py-4 ring-1 ring-outline-variant/10">
              <div className="flex-1 font-headline text-sm text-on-surface">{m.modelName}</div>
              <input
                type="number"
                min={1}
                max={365}
                className="w-28 rounded-lg bg-surface-container-high px-3 py-2 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                value={drafts[m.modelName] ?? m.blockingDurationDays}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [m.modelName]: Number(e.target.value),
                  }))
                }
              />
              <button
                type="button"
                onClick={() => saveModel(m.modelName)}
                className="px-4 py-2 rounded-lg bg-surface-container-high font-label text-[10px] uppercase tracking-widest text-on-surface ring-1 ring-outline-variant/15 hover:ring-primary/40"
              >
                Save
              </button>
            </div>
          ))}
          {models.length === 0 && (
            <p className="font-body text-xs text-on-surface-variant">
              Models appear after stock import or configure via API. Seed adds Innova Crysta & Fortuner.
            </p>
          )}
        </div>
      </section>

      {msg && <p className="font-body text-xs text-primary">{msg}</p>}
    </div>
  );
}

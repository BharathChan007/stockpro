import { useEffect, useState } from "react";
import { api } from "../../api.js";

type Summary = {
  totalVehicles: number;
  open: number;
  hardBlocked: number;
  softBlocked: number;
  delivered: number;
  expiredBlockings: number;
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daywise, setDaywise] = useState<{ date: string; count: number }[]>([]);
  const [branchwise, setBranchwise] = useState<
    {
      branchName: string;
      activeHardBlockings: number;
      deliveries: number;
      expiredBlockings: number;
      conversionRate: number;
    }[]
  >([]);
  const [modelwise, setModelwise] = useState<
    { model: string; hardBlocks: number; delivered: number; expired: number; expiryRate: number }[]
  >([]);

  useEffect(() => {
    Promise.all([
      api<Summary>("/analytics/summary"),
      api<{ date: string; count: number }[]>("/analytics/daywise"),
      api<
        {
          branchName: string;
          activeHardBlockings: number;
          deliveries: number;
          expiredBlockings: number;
          conversionRate: number;
        }[]
      >("/analytics/branchwise"),
      api<
        { model: string; hardBlocks: number; delivered: number; expired: number; expiryRate: number }[]
      >("/analytics/modelwise"),
    ])
      .then(([s, d, b, m]) => {
        setSummary(s);
        setDaywise(d);
        setBranchwise(b);
        setModelwise(m);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-on-surface">Analytics</h2>
        <p className="font-body text-sm text-on-surface-variant mt-1">Fleet-wide KPIs.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {summary &&
          Object.entries(summary).map(([k, v]) => (
            <div key={k} className="bg-surface-container-low rounded-xl p-5 ring-1 ring-outline-variant/10">
              <p className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant">{k}</p>
              <p className="font-headline text-3xl text-primary mt-2">{v as number}</p>
            </div>
          ))}
      </div>

      <section className="bg-surface-container-low rounded-xl p-6 ring-1 ring-outline-variant/10 space-y-4">
        <h3 className="font-headline text-lg uppercase text-primary">Day-wise expiring hard blocks</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {daywise.map((d) => (
            <div key={d.date} className="flex justify-between font-body text-xs text-on-surface border-b border-outline-variant/10 pb-2">
              <span>{d.date}</span>
              <span className="font-headline text-primary">{d.count}</span>
            </div>
          ))}
          {daywise.length === 0 && <p className="font-body text-xs text-on-surface-variant">No active hard blocks with expiry metadata.</p>}
        </div>
      </section>

      <section className="bg-surface-container-low rounded-xl p-6 ring-1 ring-outline-variant/10 overflow-x-auto">
        <h3 className="font-headline text-lg uppercase text-primary mb-4">Branch breakdown</h3>
        <table className="min-w-full text-left text-[11px] font-body">
          <thead className="font-label uppercase tracking-widest text-[9px] text-on-surface-variant border-b border-outline-variant/15">
            <tr>
              <th className="py-2 pr-4">Branch</th>
              <th className="py-2 pr-4">Active hard</th>
              <th className="py-2 pr-4">Delivered</th>
              <th className="py-2 pr-4">Expired</th>
              <th className="py-2 pr-4">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {branchwise.map((b) => (
              <tr key={b.branchName} className="border-b border-outline-variant/10">
                <td className="py-2 pr-4">{b.branchName}</td>
                <td className="py-2 pr-4">{b.activeHardBlockings}</td>
                <td className="py-2 pr-4">{b.deliveries}</td>
                <td className="py-2 pr-4">{b.expiredBlockings}</td>
                <td className="py-2 pr-4">{b.conversionRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-surface-container-low rounded-xl p-6 ring-1 ring-outline-variant/10 overflow-x-auto">
        <h3 className="font-headline text-lg uppercase text-primary mb-4">Model breakdown</h3>
        <table className="min-w-full text-left text-[11px] font-body">
          <thead className="font-label uppercase tracking-widest text-[9px] text-on-surface-variant border-b border-outline-variant/15">
            <tr>
              <th className="py-2 pr-4">Model</th>
              <th className="py-2 pr-4">Hard blocks</th>
              <th className="py-2 pr-4">Delivered</th>
              <th className="py-2 pr-4">Expired</th>
              <th className="py-2 pr-4">Expiry rate</th>
            </tr>
          </thead>
          <tbody>
            {modelwise.map((m) => (
              <tr key={m.model} className="border-b border-outline-variant/10">
                <td className="py-2 pr-4">{m.model}</td>
                <td className="py-2 pr-4">{m.hardBlocks}</td>
                <td className="py-2 pr-4">{m.delivered}</td>
                <td className="py-2 pr-4">{m.expired}</td>
                <td className="py-2 pr-4">{m.expiryRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

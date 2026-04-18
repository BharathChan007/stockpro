import { Link } from "react-router-dom";
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

export default function AdminHomePage() {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    api<Summary>("/analytics/summary").then(setS).catch(() => {});
  }, []);

  const cards = [
    { label: "Total stock", value: s?.totalVehicles ?? "—", to: "/admin/stock" },
    { label: "Open / available", value: s?.open ?? "—", to: "/admin/stock" },
    { label: "Hard blocked", value: s?.hardBlocked ?? "—", to: "/admin/blockings" },
    { label: "Soft blocked", value: s?.softBlocked ?? "—", to: "/admin/blockings" },
    { label: "Delivered", value: s?.delivered ?? "—", to: "/admin/analytics" },
    { label: "Expired blockings", value: s?.expiredBlockings ?? "—", to: "/admin/analytics" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-on-surface">Admin dashboard</h2>
        <p className="font-body text-sm text-on-surface-variant mt-1">Operational telemetry across branches.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="bg-surface-container-low rounded-xl p-6 ring-1 ring-outline-variant/10 hover:ring-primary/40 transition-all group"
          >
            <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">{c.label}</p>
            <p className="font-headline text-4xl font-bold text-primary mt-3 group-hover:translate-y-[-2px] transition-transform">
              {c.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/admin/blockings"
          className="rounded-xl bg-gradient-to-br from-primary/20 to-primary-container/30 px-8 py-10 font-headline uppercase tracking-widest text-sm text-primary ring-1 ring-primary/30 hover:brightness-110"
        >
          Review all blockings →
        </Link>
        <Link
          to="/admin/config"
          className="rounded-xl bg-surface-container-low px-8 py-10 font-headline uppercase tracking-widest text-sm text-on-surface ring-1 ring-outline-variant/15 hover:ring-primary/40"
        >
          Configure blocking durations →
        </Link>
      </div>
    </div>
  );
}

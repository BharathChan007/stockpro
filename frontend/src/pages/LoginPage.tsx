import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/sales/dashboard"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(loginId.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-surface opacity-95" />
      <div className="fixed inset-0 -z-10 opacity-30 bg-gradient-to-br from-primary-container/30 via-transparent to-tertiary-container/10" />

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden rounded-xl bg-surface-container-low shadow-2xl shadow-black/50">
        <div className="lg:col-span-6 hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-surface-container-low to-surface">
          <div>
            <h1 className="font-headline text-3xl font-black tracking-tighter text-primary uppercase">Kinetic Precision</h1>
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mt-2 opacity-70">
              Vehicle stock cockpit
            </p>
          </div>
          <p className="font-body text-sm text-on-surface-variant max-w-sm leading-relaxed">
            Real-time inventory, branch visibility, and controlled blocking — without the phone tag.
          </p>
        </div>

        <div className="lg:col-span-6 p-8 lg:p-12 glass-overlay">
          <form onSubmit={onSubmit} className="space-y-8 max-w-md mx-auto">
            <div>
              <h2 className="font-headline text-xl font-bold tracking-tight uppercase text-on-surface">Secure Access</h2>
              <p className="font-label text-xs text-on-surface-variant mt-2 uppercase tracking-wider">Credentials issued by Admin</p>
            </div>

            <div className="space-y-6">
              <label className="block space-y-2">
                <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant">Login ID</span>
                <input
                  className="w-full rounded-lg bg-surface-container-high/80 px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary transition-shadow"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant">Password</span>
                <input
                  type="password"
                  className="w-full rounded-lg bg-surface-container-high/80 px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary transition-shadow"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-tertiary-container/15 px-4 py-3 font-label text-xs text-tertiary border border-tertiary-container/30">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-br from-primary to-primary-container py-4 font-headline font-bold uppercase tracking-widest text-sm text-on-primary shadow-xl shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Enter Cockpit"}
            </button>

            <p className="font-label text-[10px] text-on-surface-variant text-center uppercase tracking-wider">
              No self-registration — contact stock administration.
            </p>
          </form>
        </div>
      </div>

      <span className="sr-only">
        <Link to="/login">Login</Link>
      </span>
    </div>
  );
}

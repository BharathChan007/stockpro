import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api.js";

type Branch = { id: string; name: string };
type UserRow = {
  id: string;
  loginId: string;
  role: "ADMIN" | "SALES_MANAGER";
  fullName: string;
  branchId: string | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SALES_MANAGER">("SALES_MANAGER");
  const [branchId, setBranchId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const [u, b] = await Promise.all([api<UserRow[]>("/users"), api<Branch[]>("/branches")]);
    setUsers(u);
    setBranches(b);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await api("/users", {
      method: "POST",
      body: JSON.stringify({
        loginId: loginId.trim(),
        password,
        fullName: fullName.trim(),
        role,
        branchId: role === "SALES_MANAGER" ? branchId : null,
      }),
    });
    setLoginId("");
    setPassword("");
    setFullName("");
    setMsg("User created.");
    await refresh();
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <h2 className="font-headline text-3xl font-bold uppercase tracking-tighter text-on-surface">Users</h2>
        <p className="font-body text-sm text-on-surface-variant mt-1">Provision credentials — no self-registration.</p>
      </div>

      <form onSubmit={createUser} className="bg-surface-container-low rounded-xl p-8 ring-1 ring-outline-variant/10 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Login ID</span>
            <input
              required
              className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </label>
          <label className="space-y-2 block">
            <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Password</span>
            <input
              type="password"
              required
              className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="space-y-2 block md:col-span-2">
            <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Full name</span>
            <input
              required
              className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="space-y-2 block">
            <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Role</span>
            <select
              className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "SALES_MANAGER")}
            >
              <option value="SALES_MANAGER">Sales manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          {role === "SALES_MANAGER" && (
            <label className="space-y-2 block">
              <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Branch</span>
              <select
                required
                className="w-full rounded-lg bg-surface-container-high px-4 py-3 font-body text-sm outline-none ring-1 ring-outline-variant/15 focus:ring-primary"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button
          type="submit"
          className="px-8 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container font-headline text-xs uppercase tracking-widest text-on-primary"
        >
          Create user
        </button>
        {msg && <p className="font-body text-xs text-primary">{msg}</p>}
      </form>

      <div className="rounded-xl ring-1 ring-outline-variant/10 bg-surface-container-low overflow-hidden">
        <table className="min-w-full text-left text-xs font-body">
          <thead className="font-label uppercase tracking-widest text-[9px] text-on-surface-variant border-b border-outline-variant/15">
            <tr>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-outline-variant/10">
                <td className="px-4 py-3 font-mono">{u.loginId}</td>
                <td className="px-4 py-3">{u.fullName}</td>
                <td className="px-4 py-3 uppercase font-label">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

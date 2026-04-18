import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

const navCls = ({ isActive }: { isActive: boolean }) =>
  [
    "px-4 py-3 flex items-center gap-3 font-body font-semibold text-xs uppercase tracking-wider transition-all rounded-lg mx-2",
    isActive ? "bg-primary-container/20 text-primary border-r-4 border-primary-container" : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-primary",
  ].join(" ");

export default function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 bg-zinc-900 flex-col py-6 z-40 shadow-2xl shadow-black/40">
        <div className="px-6 mb-8">
          <h2 className="text-primary font-headline font-black tracking-widest text-lg uppercase">Admin</h2>
          <p className="font-label font-semibold text-[10px] text-on-surface-variant uppercase tracking-tighter">Stock control</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          <NavLink to="/admin" end className={navCls}>
            <span className="material-symbols-outlined text-xl">dashboard</span>
            Overview
          </NavLink>
          <NavLink to="/admin/stock" className={navCls}>
            <span className="material-symbols-outlined text-xl">inventory_2</span>
            Stock
          </NavLink>
          <NavLink to="/admin/blockings" className={navCls}>
            <span className="material-symbols-outlined text-xl">lock_open</span>
            All Blockings
          </NavLink>
          <NavLink to="/admin/config" className={navCls}>
            <span className="material-symbols-outlined text-xl">tune</span>
            Configuration
          </NavLink>
          <NavLink to="/admin/analytics" className={navCls}>
            <span className="material-symbols-outlined text-xl">insights</span>
            Analytics
          </NavLink>
          <NavLink to="/admin/users" className={navCls}>
            <span className="material-symbols-outlined text-xl">group</span>
            Users
          </NavLink>
        </nav>
        <div className="px-4 py-4 border-t border-outline-variant/10">
          <button
            type="button"
            className="w-full text-left text-on-surface-variant px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high rounded-lg font-body text-xs uppercase"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl flex justify-between items-center px-6 py-3">
          <span className="font-headline text-lg uppercase tracking-tighter text-primary">Kinetic Precision — Admin</span>
          <div className="text-right">
            <div className="font-body text-xs font-semibold">{user?.fullName}</div>
            <div className="font-label text-[10px] text-on-surface-variant uppercase">Administrator</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

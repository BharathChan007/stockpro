import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

const navCls = ({ isActive }: { isActive: boolean }) =>
  [
    "px-4 py-3 flex items-center gap-3 font-body font-semibold text-xs uppercase tracking-wider transition-all duration-300 rounded-lg mx-2",
    isActive ? "bg-primary-container/20 text-primary border-r-4 border-primary-container" : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-primary",
  ].join(" ");

export default function SalesShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 bg-zinc-900 flex-col py-6 z-40 shadow-2xl shadow-black/40">
        <div className="px-6 mb-8">
          <h2 className="text-primary font-headline font-black tracking-widest text-lg uppercase">Kinetic Precision</h2>
          <p className="font-label font-semibold text-[10px] text-on-surface-variant uppercase tracking-tighter">
            {user?.branch?.name ?? "Branch"}
          </p>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink to="/sales/dashboard" className={navCls}>
            <span className="material-symbols-outlined text-xl">analytics</span>
            Live Inventory
          </NavLink>
          <NavLink to="/sales/block" className={navCls}>
            <span className="material-symbols-outlined text-xl">directions_car</span>
            Reserve Vehicle
          </NavLink>
          <NavLink to="/sales/blockings" className={navCls}>
            <span className="material-symbols-outlined text-xl">lock_clock</span>
            My Blockings
          </NavLink>
        </nav>
        <div className="px-4 py-4 space-y-2 border-t border-outline-variant/10">
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
        <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl flex justify-between items-center w-full px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold tracking-tighter text-primary font-headline uppercase md:hidden">KP</span>
            <nav className="hidden md:flex items-center gap-6 font-headline tracking-tighter uppercase text-sm">
              <NavLink
                to="/sales/dashboard"
                className={({ isActive }) =>
                  isActive ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-primary"
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/sales/blockings"
                className={({ isActive }) =>
                  isActive ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-primary"
                }
              >
                My Blockings
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full ring-1 ring-outline-variant/10">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest">Live</span>
            </div>
            <div className="text-right hidden sm:block">
              <div className="font-body text-xs font-semibold text-on-surface">{user?.fullName}</div>
              <div className="font-label text-[10px] text-on-surface-variant uppercase">{user?.branch?.name}</div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

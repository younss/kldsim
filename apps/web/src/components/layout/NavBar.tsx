import { NavLink, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { PlatformRole } from "@kldsim/shared";
import { useAuthStore } from "../../state/authStore";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    "relative rounded-md px-3 py-1.5 text-sm font-medium transition-all",
    isActive ? "bg-white/[0.07] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
  );

export function NavBar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isStaff = user?.role === PlatformRole.FACILITATOR || user?.role === PlatformRole.PLATFORM_ADMIN;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-surface/70 px-6 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-violet-500 text-sm shadow-[0_0_16px_rgba(74,168,255,0.5)]">
            K
          </span>
          KLD<span className="bg-gradient-to-r from-brand-300 to-violet-300 bg-clip-text text-transparent">Sim</span>
        </span>
        <nav className="flex items-center gap-1">
          {isStaff && (
            <NavLink to="/studio" className={linkClass}>
              Game Studio
            </NavLink>
          )}
          <NavLink to="/sessions" className={linkClass}>
            Sessions
          </NavLink>
          <NavLink to="/docs" className={linkClass}>
            Docs
          </NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="text-right">
          <div className="text-slate-200">{user?.displayName}</div>
          <div className="text-xs text-slate-500">{user?.role}</div>
        </div>
        <button
          onClick={() => {
            void logout().then(() => navigate("/login"));
          }}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

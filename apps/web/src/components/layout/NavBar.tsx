import { NavLink, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { PlatformRole } from "@kldsim/shared";
import { useAuthStore } from "../../state/authStore";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive ? "bg-brand-600/20 text-brand-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
  );

export function NavBar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isStaff = user?.role === PlatformRole.FACILITATOR || user?.role === PlatformRole.PLATFORM_ADMIN;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-surface-border bg-surface/90 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold tracking-tight text-white">
          KLD<span className="text-brand-400">Sim</span>
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
          className="rounded-md border border-surface-border px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

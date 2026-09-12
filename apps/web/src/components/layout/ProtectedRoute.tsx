import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { PlatformRole } from "@kldsim/shared";
import { useAuthStore } from "../../state/authStore";

export function ProtectedRoute({ allow }: { allow?: PlatformRole[] }) {
  const { user, status, bootstrap } = useAuthStore();

  useEffect(() => {
    if (status === "idle") void bootstrap();
  }, [status, bootstrap]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        <span className="animate-pulse">Loading KLD Sim…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/" replace />;

  return <Outlet />;
}

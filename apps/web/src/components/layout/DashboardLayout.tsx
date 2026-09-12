import { Outlet } from "react-router-dom";
import { NavBar } from "./NavBar";

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

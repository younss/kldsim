import clsx from "clsx";
import type { TopologyNodeHealth } from "@kldsim/shared";

const HEALTH_STYLES: Record<TopologyNodeHealth, string> = {
  HEALTHY: "bg-health-healthy/15 text-health-healthy border-health-healthy/30",
  AT_RISK: "bg-health-atRisk/15 text-health-atRisk border-health-atRisk/30",
  DEGRADED: "bg-health-degraded/15 text-health-degraded border-health-degraded/30",
  CRITICAL: "bg-health-critical/15 text-health-critical border-health-critical/30",
};

export function HealthBadge({ health }: { health: TopologyNodeHealth }) {
  return <span className={clsx("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", HEALTH_STYLES[health])}>{health.replace("_", " ")}</span>;
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "brand" | "success" | "warning" | "danger" }) {
  const tones: Record<string, string> = {
    default: "bg-white/5 text-slate-300 border-white/10",
    brand: "bg-brand-500/15 text-brand-300 border-brand-500/30",
    success: "bg-health-healthy/15 text-health-healthy border-health-healthy/30",
    warning: "bg-health-atRisk/15 text-health-atRisk border-health-atRisk/30",
    danger: "bg-health-critical/15 text-health-critical border-health-critical/30",
  };
  return <span className={clsx("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", tones[tone])}>{children}</span>;
}

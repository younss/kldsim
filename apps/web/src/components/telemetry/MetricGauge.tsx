import clsx from "clsx";
import type { TopologyNodeHealth } from "@kldsim/shared";
import { HealthBadge } from "../common/Badge";

function goodnessToHealth(goodness: number): TopologyNodeHealth {
  if (goodness >= 75) return "HEALTHY";
  if (goodness >= 50) return "AT_RISK";
  if (goodness >= 25) return "DEGRADED";
  return "CRITICAL";
}

const FILL_CLASS: Record<TopologyNodeHealth, string> = {
  HEALTHY: "bg-health-healthy",
  AT_RISK: "bg-health-atRisk",
  DEGRADED: "bg-health-degraded",
  CRITICAL: "bg-health-critical",
};

/**
 * A 0-100 metric rendered as a stat tile with a meter fill. `invert` flips
 * which end of the scale reads as "good" — technicalDebtIndex is bad-high,
 * deliveryVelocity/stakeholderTrust are good-high.
 */
export function MetricGauge({ label, value, invert = false, hint }: { label: string; value: number; invert?: boolean; hint?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const goodness = invert ? 100 - clamped : clamped;
  const health = goodnessToHealth(goodness);

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <HealthBadge health={health} />
      </div>
      <div className="mb-2 text-2xl font-semibold tabular-nums text-white">{Math.round(clamped)}</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className={clsx("h-full rounded-full transition-all", FILL_CLASS[health])} style={{ width: `${clamped}%` }} />
      </div>
      {hint && <p className="mt-2 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function CurrencyStatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-white">{value}</div>
      {hint && <p className="mt-2 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

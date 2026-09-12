import type { EnterpriseMetrics } from "@kldsim/shared";
import { MetricGauge, CurrencyStatTile } from "./MetricGauge";
import { formatCurrency } from "../../lib/format";

export function MetricsGrid({ metrics }: { metrics: EnterpriseMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <CurrencyStatTile label="Total Cost of Ownership" value={formatCurrency(metrics.tco)} hint="Cumulative spend to date" />
      <MetricGauge label="Technical Debt Index" value={metrics.technicalDebtIndex} invert hint="Lower is healthier" />
      <MetricGauge label="Delivery Velocity" value={metrics.deliveryVelocity} hint="Throughput vs. plan" />
      <MetricGauge label="Stakeholder Trust" value={metrics.stakeholderTrust} hint="Aggregate persona sentiment" />
    </div>
  );
}

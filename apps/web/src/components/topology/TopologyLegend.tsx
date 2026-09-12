const HEALTH_ITEMS: Array<{ label: string; color: string }> = [
  { label: "Healthy", color: "#0ca30c" },
  { label: "At risk", color: "#fab219" },
  { label: "Degraded", color: "#ec835a" },
  { label: "Critical", color: "#d03b3b" },
];

const KIND_ITEMS: Array<{ label: string; symbol: string }> = [
  { label: "Capability", symbol: "◆" },
  { label: "Application", symbol: "■" },
  { label: "Data store", symbol: "●" },
  { label: "Integration", symbol: "◈" },
  { label: "External partner", symbol: "▲" },
];

export function TopologyLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-[11px] text-slate-400">
      {HEALTH_ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
      <span className="mx-1 h-3 w-px bg-surface-border" />
      {KIND_ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="text-slate-500">{item.symbol}</span>
          {item.label}
        </span>
      ))}
      <span className="mx-1 h-3 w-px bg-surface-border" />
      <span>Pulsing / halo = bottleneck</span>
    </div>
  );
}

import type { PropsWithChildren, ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/[0.08] bg-gradient-to-b from-surface-raised to-surface-raised/60 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-shadow",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

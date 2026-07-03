import type { ReactNode } from "react";

/** Frosted card surface used across the dashboard. */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] backdrop-blur-xl " +
        className
      }
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  hint,
}: {
  title: string;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
        {title}
      </h2>
      {hint ? <div className="text-xs text-white/40">{hint}</div> : null}
    </div>
  );
}

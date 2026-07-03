"use client";

import type { WeightPoint } from "@nutrition/types";

/**
 * Weight trend chart: faint scale-weight dots + a smooth trend line.
 * Pure inline SVG so we ship zero charting dependencies.
 */
export function WeightTrendChart({ series }: { series: WeightPoint[] }) {
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 24, left: 36 };

  if (series.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-white/30">
        No weight data yet
      </div>
    );
  }

  const trends = series.map((p) => p.trend);
  const scales = series
    .map((p) => p.scale)
    .filter((v): v is number => v !== null);
  const all = [...trends, ...scales];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  // Pad the domain a touch so the line never kisses the edges.
  const yMin = min - range * 0.1;
  const yMax = max + range * 0.1;

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const x = (i: number) =>
    pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v: number) =>
    pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const trendPath = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.trend).toFixed(1)}`)
    .join(" ");

  const areaPath =
    `${trendPath} L ${x(series.length - 1).toFixed(1)} ${(pad.top + innerH).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`;

  const first = series[0].trend;
  const last = series[series.length - 1].trend;
  const net = last - first;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-2xl font-bold text-white">{last.toFixed(1)} kg</div>
          <div className="text-xs text-white/40">trend weight</div>
        </div>
        <div className={`text-sm font-semibold ${net <= 0 ? "text-white" : "text-white/50"}`}>
          {net > 0 ? "+" : ""}
          {net.toFixed(1)} kg
          <span className="ml-1 text-white/30">over {series.length}d</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.9)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              className="text-white/5"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-white/30"
              fontSize={10}
            >
              {t.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#weightArea)" />

        {series.map((p, i) =>
          p.scale !== null ? (
            <circle key={i} cx={x(i)} cy={y(p.scale)} r={1.6} className="fill-white/20" />
          ) : null
        )}

        <path
          d={trendPath}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={x(series.length - 1)} cy={y(last)} r={4} className="fill-white/90" />

        <text x={pad.left} y={height - 6} className="fill-white/30" fontSize={10}>
          {fmtDate(series[0].date)}
        </text>
        <text x={width - pad.right} y={height - 6} textAnchor="end" className="fill-white/30" fontSize={10}>
          {fmtDate(series[series.length - 1].date)}
        </text>
      </svg>
    </div>
  );
}

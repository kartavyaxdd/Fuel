"use client";

/**
 * A circular calorie-budget gauge. Renders consumed vs. target as an arc,
 * with the remaining number front and center. Pure SVG — no chart deps.
 */
export function CalorieRing({
  consumed,
  target,
  remaining,
}: {
  consumed: number;
  target: number;
  remaining: number;
}) {
  const size = 220;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const dash = circumference * pct;
  const over = remaining < 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-white/5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#calorieGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="calorieGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={over ? "rgba(255,60,60,0.9)" : "rgba(255,255,255,0.9)"} />
            <stop offset="100%" stopColor={over ? "rgba(255,60,60,0.6)" : "rgba(255,255,255,0.55)"} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className={`text-4xl font-bold tracking-tight ${
            over ? "text-red-400" : "text-white"
          }`}
        >
          {Math.abs(remaining)}
        </span>
        <span className="text-xs uppercase tracking-widest text-white/40 mt-1">
          {over ? "over" : "remaining"}
        </span>
        <span className="text-sm text-white/50 mt-2">
          {consumed} / {target} kcal
        </span>
      </div>
    </div>
  );
}

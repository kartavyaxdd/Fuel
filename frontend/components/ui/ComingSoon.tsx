import { Panel } from "@/components/ui/Panel";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  /** Inline SVG path data rendered at 24x24. */
  icon: string;
  bullets?: string[];
};

/**
 * Elegant placeholder for features that are scaffolded in the nav but not
 * yet built. Keeps the app fully navigable and communicates intent.
 */
export function ComingSoon({ eyebrow, title, description, icon, bullets }: Props) {
  return (
    <div>
      <header className="mb-8">
        <p className="text-sm font-medium text-white/50">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">{title}</h1>
      </header>

      <Panel>
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <span className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.06] to-transparent" />
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-white/70" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d={icon} />
            </svg>
          </span>

          <h2 className="text-xl font-semibold text-white">Coming soon</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">
            {description}
          </p>

          {bullets && bullets.length > 0 ? (
            <ul className="mt-8 grid w-full max-w-md gap-2 text-left sm:grid-cols-2">
              {bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-sm text-white/60"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/70" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l4 4 10-11" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

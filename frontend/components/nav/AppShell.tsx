import { Sidebar, BottomNav } from "./Sidebar";

/**
 * Application chrome: ambient background, persistent left rail on desktop,
 * bottom tab bar on mobile, and the scrollable content column in between.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Ambient gradient wash — sits behind everything. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0" style={{background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.03) 0%, transparent 70%)'}} />
      </div>

      <Sidebar />

      <main className="min-h-screen pb-24 lg:pb-0 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

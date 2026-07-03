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
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/[0.07] blur-[120px]" />
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

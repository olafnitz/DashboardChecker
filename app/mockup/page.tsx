import type { Metadata } from 'next'
import { LayoutDashboard, PlusCircle, User, Menu, Search, Bell } from 'lucide-react'

export const metadata: Metadata = {
  title: 'UI Shell Mockup — Dashboard Checker',
  description: 'Static preview only; navigation is non-functional.',
  robots: { index: false, follow: false },
}

/**
 * Static UX mockup for sidebar + app shell. No real navigation or data.
 * Open at /mockup while running the dev server.
 */
export default function MockupPage() {
  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900">
      {/* Preview banner */}
      <div
        className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900"
        role="status"
      >
        UI-Mockup (nur Vorschau) — Sidebar &amp; Navigation ohne Funktion. Später durch echtes Layout ersetzen.
      </div>

      <div className="flex min-h-[calc(100vh-2.5rem)]">
        {/* Desktop sidebar */}
        <aside
          className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex"
          aria-hidden
        >
          <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4F46E5] text-sm font-bold text-white">
              DC
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">Dashboard Checker</p>
              <p className="text-xs text-slate-500">Mock shell</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            <div className="flex items-center gap-3 rounded-[8px] bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-[#4F46E5] ring-1 ring-inset ring-indigo-100">
              <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden />
              Dashboards
            </div>
            <div className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium text-slate-600">
              <PlusCircle className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              New dashboard
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Later
              </p>
              <div className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium text-slate-400">
                <Bell className="h-5 w-5 shrink-0" aria-hidden />
                Notifications
              </div>
              <div className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium text-slate-400">
                <User className="h-5 w-5 shrink-0" aria-hidden />
                Account
              </div>
            </div>
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3 rounded-[8px] bg-slate-50 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                U
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">user@example.com</p>
                <p className="text-xs text-slate-500">Signed in</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar (mock: menu icon decorative only) */}
          <header className="flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
            <div className="flex items-center gap-2 text-slate-500" aria-hidden>
              <Menu className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-950">Dashboards</p>
            <div className="w-6" />
          </header>

          {/* Optional top toolbar (desktop) */}
          <header className="hidden h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 lg:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#4F46E5]">Overview</p>
              <h1 className="text-lg font-bold text-slate-950">Your dashboards</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-64 items-center gap-2 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                Search… (mock)
              </div>
              <span className="btn btn-primary pointer-events-none opacity-90">New dashboard</span>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <p className="text-sm text-slate-600 lg:hidden">
                Auf größeren Viewports erscheint links die Sidebar; hier die mobile Kopfzeile.
              </p>

              {/* Fake list cards */}
              <div className="grid gap-4">
                {[
                  { name: 'Marketing overview', url: 'lookerstudio.google.com/...', ok: true, last: 'Today, 09:41' },
                  { name: 'Sales KPIs', url: 'lookerstudio.google.com/...', ok: false, last: 'Yesterday, 18:02' },
                  { name: 'Ops health', url: 'lookerstudio.google.com/...', ok: true, last: 'Apr 3, 2026' },
                ].map((d) => (
                  <div
                    key={d.name}
                    className="card-base border-l-4 border-[#4F46E5]/30 p-6"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                            d.ok ? 'status-green' : 'status-red'
                          }`}
                        >
                          <span className="text-lg">{d.ok ? '✓' : '!'}</span>
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-slate-900">{d.name}</h2>
                          <p className="mt-1 max-w-xl truncate text-sm text-slate-500">{d.url}</p>
                          <p className="mt-3 text-sm text-slate-500">
                            Last checked:{' '}
                            <span className="font-medium text-slate-700">{d.last}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="btn btn-secondary pointer-events-none text-sm">Open</span>
                        <span className="btn btn-secondary pointer-events-none text-sm">Check now</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detail preview strip */}
              <div className="card-base overflow-hidden border-2 border-emerald-200 bg-emerald-50/40 p-0">
                <div className="border-b border-emerald-200 bg-white px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Mock — audit history (collapsed)
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-lg">✓</span>
                    <p className="text-lg font-bold text-slate-950">All pages passed</p>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      4/4 pages OK
                    </span>
                    <span className="ml-auto text-sm text-slate-600">Apr 5, 2026, 10:15</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Chevron + klickbare Zeile wie auf der echten Detailseite (hier nur Platzhalter).</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

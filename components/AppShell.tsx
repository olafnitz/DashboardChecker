'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Menu, PlusCircle, UserCircle2, X } from 'lucide-react'

const navigationItems = [
  {
    href: '/',
    label: 'Dashboards',
    icon: LayoutDashboard,
    match: (pathname: string) => pathname === '/' || (pathname.startsWith('/dashboards/') && pathname !== '/dashboards/new'),
  },
  {
    href: '/dashboards/new',
    label: 'Neues Dashboard',
    icon: PlusCircle,
    match: (pathname: string) => pathname === '/dashboards/new',
  },
  {
    href: '/auth',
    label: 'Account',
    icon: UserCircle2,
    match: (pathname: string) => pathname === '/auth',
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-6">
        <Link
          href="/"
          className="focus-ring inline-flex items-center gap-3 rounded-[10px] text-slate-950"
          onClick={() => setMobileMenuOpen(false)}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#4F46E5] text-white shadow-sm">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold uppercase tracking-[0.24em] text-[#4F46E5]">
              Monitor
            </span>
            <span className="block text-lg font-extrabold tracking-tight text-slate-950">
              DashboardChecker
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6" aria-label="Primary">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = item.match(pathname)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`focus-ring flex items-center gap-3 rounded-[12px] px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200 px-6 py-5">
        <div className="rounded-[14px] bg-slate-100 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Schnellzugriff
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Dashboards, neue Checks und dein Account bleiben jederzeit erreichbar.
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.10),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/85 backdrop-blur md:block">
          {navigation}
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/" className="focus-ring text-base font-extrabold tracking-tight text-slate-950">
                DashboardChecker
              </Link>
              <button
                type="button"
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-700"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Navigation öffnen"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-slate-950/40"
                aria-label="Navigation schließen"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="absolute left-0 top-0 h-full w-[84%] max-w-xs border-r border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-end border-b border-slate-200 px-4 py-3">
                  <button
                    type="button"
                    className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-700"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Navigation schließen"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {navigation}
              </div>
            </div>
          )}

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}

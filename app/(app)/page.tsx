import { DashboardList } from '@/components/DashboardList'

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="card-base overflow-hidden border-slate-200 bg-white/90 p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4F46E5]">
          Dashboard Monitoring
        </p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
          Deine Dashboards an einem Ort.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Behalte Looker-Studio-Dashboards im Blick, springe direkt in neue Checks und verwalte deine Monitoring-Strecken ohne Umwege.
        </p>
      </section>

      <DashboardList />
    </div>
  )
}

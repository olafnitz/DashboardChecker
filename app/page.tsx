import { DashboardList } from '@/components/DashboardList'

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Dashboard Checker
        </h1>
        <p className="text-lg text-gray-600">
          Monitor your Google Looker Studio dashboards automatically
        </p>
      </div>

      <DashboardList />
    </main>
  )
}
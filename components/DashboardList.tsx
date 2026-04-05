'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Dashboard {
  id: string
  name: string
  url: string
  created_at: string
}

interface DashboardWithStatus extends Dashboard {
  lastCheck?: {
    status: 'ok' | 'error'
    timestamp: string
  }
}

export function DashboardList() {
  const [dashboards, setDashboards] = useState<DashboardWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboards()
  }, [])

  const fetchDashboards = async () => {
    try {
      setLoading(true)

      // Fetch dashboards
      const { data: dashboardsData, error: dashboardsError } = await supabase
        .from('dashboards')
        .select('*')
        .order('created_at', { ascending: false })

      if (dashboardsError) throw dashboardsError

      // Fetch latest check results for each dashboard
      const dashboardsWithStatus = await Promise.all(
        (dashboardsData || []).map(async (dashboard) => {
          const { data: checkResult } = await supabase
            .from('check_results')
            .select('overall_status, timestamp')
            // @ts-ignore - dashboard type not available with placeholder env vars
            .eq('dashboard_id', dashboard.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single()

          return {
            // @ts-ignore - dashboard type not available with placeholder env vars
            ...dashboard,
            lastCheck: checkResult ? {
              // @ts-ignore - checkResult type not available with placeholder env vars
              status: checkResult.overall_status,
              // @ts-ignore - checkResult type not available with placeholder env vars
              timestamp: checkResult.timestamp,
            } : undefined,
          }
        })
      )

      setDashboards(dashboardsWithStatus)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteDashboard = async (id: string) => {
    if (!confirm('Bist du sicher, dass du dieses Dashboard löschen möchtest?')) return

    try {
      const { error } = await supabase
        .from('dashboards')
        .delete()
        // @ts-ignore - Supabase types not available with placeholder env vars
        .eq('id', id)

      if (error) throw error

      setDashboards(dashboards.filter(d => d.id !== id))
    } catch (error: any) {
      setError(error.message)
    }
  }

  const getStatusIcon = (status?: 'ok' | 'error') => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusClass = (status?: 'ok' | 'error') => {
    switch (status) {
      case 'ok':
        return 'status-green'
      case 'error':
        return 'status-red'
      default:
        return 'status-gray'
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4F46E5]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-[8px] p-4">
        <p className="text-rose-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4F46E5]">Dashboard Monitoring</p>
          <h2 className="text-3xl font-bold text-slate-900">Deine Dashboards</h2>
          <p className="mt-2 text-slate-600 max-w-2xl">
            Ein kuratierter Überblick über die Gesundheit deiner Dashboards, deren Status und die letzten Aktualisierungszeiten.
          </p>
        </div>

        <Link
          href="/dashboards/new"
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neues Dashboard
        </Link>
      </div>

      {dashboards.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-slate-600 mb-4">Noch keine Dashboards vorhanden</p>
          <Link
            href="/dashboards/new"
            className="btn btn-primary"
          >
            Erstes Dashboard anlegen
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {dashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className="card-base border-l-4 border-[#4F46E5]/30 p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <div className={`inline-flex items-center justify-center h-11 w-11 rounded-full ${getStatusClass(dashboard.lastCheck?.status)}`}>
                    {getStatusIcon(dashboard.lastCheck?.status)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{dashboard.name}</h3>
                    <p className="text-sm text-slate-500 truncate max-w-xl">{dashboard.url}</p>
                    {dashboard.lastCheck && (
                      <p className="text-sm text-slate-500 mt-3">
                        Zuletzt geprüft: <span className="font-medium text-slate-700">{new Date(dashboard.lastCheck.timestamp).toLocaleString()}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <Link
                    href={`/dashboards/${dashboard.id}`}
                    className="btn btn-secondary text-sm"
                  >
                    Details ansehen
                  </Link>
                  <Link
                    href={`/dashboards/${dashboard.id}/edit`}
                    className="focus-ring inline-flex items-center justify-center h-11 w-11 rounded-[8px] bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => deleteDashboard(dashboard.id)}
                    className="focus-ring inline-flex items-center justify-center h-11 w-11 rounded-[8px] bg-slate-100 text-slate-700 hover:bg-rose-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

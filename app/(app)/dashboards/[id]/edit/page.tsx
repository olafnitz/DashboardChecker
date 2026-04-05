'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { DashboardForm } from '@/components/DashboardForm'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { supabase } from '@/lib/supabase/client'

export default function EditDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const dashboardId = params.id as string

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [fetchLoading, setFetchLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setAuthLoading(false)

      if (!user) {
        router.push('/auth')
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        router.push('/auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (dashboardId && user) {
      fetchDashboard()
    }
  }, [dashboardId, user])

  const fetchDashboard = async () => {
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        // @ts-ignore - Supabase types not available with placeholder env vars
        .eq('id', dashboardId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      // @ts-ignore - Supabase types not available with placeholder env vars
      setName(data.name)
      // @ts-ignore - Supabase types not available with placeholder env vars
      setUrl(data.url)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setFetchLoading(false)
    }
  }

  if (authLoading || fetchLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full border-b-2 border-[#4F46E5] h-10 w-10" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card-base p-8 text-center">
          <p className="mb-4 text-slate-600">Sie müssen angemeldet sein, um ein Dashboard zu bearbeiten.</p>
          <Link href="/auth" className="btn btn-primary">
            Zum Login
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card-base border-rose-200 bg-rose-50 p-6">
          <p className="font-medium text-rose-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: 'Dashboards', href: '/' },
            { label: name || 'Dashboard', href: `/dashboards/${dashboardId}` },
            { label: 'Bearbeiten' },
          ]}
        />
        <h1 className="text-3xl font-bold text-slate-950">Dashboard bearbeiten</h1>
        <p className="mt-2 text-slate-600">
          Aktualisiere Details und Monitoring-Einstellungen, ohne den Kontext der App zu verlassen.
        </p>
      </div>

      <div className="card-base p-6">
        <DashboardForm
          initialData={{
            id: dashboardId,
            name,
            url,
          }}
          onSuccess={() => router.push(`/dashboards/${dashboardId}`)}
        />
      </div>
    </div>
  )
}

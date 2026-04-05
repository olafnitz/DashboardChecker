'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardForm } from '@/components/DashboardForm'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { supabase } from '@/lib/supabase/client'

export default function NewDashboardPage() {
  const router = useRouter()
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

  if (authLoading) {
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
          <p className="mb-4 text-slate-600">Sie müssen angemeldet sein, um ein Dashboard zu erstellen.</p>
          <Link href="/auth" className="btn btn-primary">
            Zum Login
          </Link>
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
            { label: 'Neu' },
          ]}
        />
        <h1 className="text-3xl font-bold text-slate-950">Neues Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Lege ein neues Dashboard an und starte direkt mit automatisierten Health Checks.
        </p>
      </div>

      <div className="card-base p-6">
        <DashboardForm onSuccess={() => router.push('/')} />
      </div>
    </div>
  )
}

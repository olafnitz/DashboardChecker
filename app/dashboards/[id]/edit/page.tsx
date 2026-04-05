'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { DashboardForm } from '@/components/DashboardForm'

interface Dashboard {
  id: string
  name: string
  url: string
  created_at: string
}

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
    // Check if user is authenticated
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setAuthLoading(false)

      if (!user) {
        router.push('/auth')
      }
    }

    checkUser()

    // Listen for auth changes
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
      <main className="min-h-screen bg-[#F8FAFC] py-12 px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-slate-600">Loading...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <div className="card-base p-8 text-center">
            <p className="text-slate-600 mb-4">You must be logged in to edit a dashboard.</p>
            <Link
              href="/auth"
              className="btn btn-primary"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/dashboards/${dashboardId}`}
            className="inline-flex items-center text-[#4F46E5] hover:text-[#4338CA] mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-950">Edit Dashboard</h1>
          <p className="text-slate-600 mt-2">
            Update your dashboard details and monitoring settings.
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
    </main>
  )
}
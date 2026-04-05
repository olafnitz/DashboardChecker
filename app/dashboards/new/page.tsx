'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { DashboardForm } from '@/components/DashboardForm'

export default function NewDashboardPage() {
  const router = useRouter()
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

  if (authLoading) {
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
            <p className="text-slate-600 mb-4">You must be logged in to create a dashboard.</p>
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
            href="/"
            className="inline-flex items-center text-[#4F46E5] hover:text-[#4338CA] mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard List
          </Link>
          <h1 className="text-3xl font-bold text-slate-950">Add New Dashboard</h1>
          <p className="text-slate-600 mt-2">
            Create a new dashboard to monitor with automated health checks.
          </p>
        </div>

        <div className="card-base p-6">
          <DashboardForm onSuccess={() => router.push('/')} />
        </div>
      </div>
    </main>
  )
}
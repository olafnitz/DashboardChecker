'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface DashboardFormProps {
  initialData?: {
    id?: string
    name: string
    url: string
  }
  onSuccess?: () => void
}

export function DashboardForm({ initialData, onSuccess }: DashboardFormProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [url, setUrl] = useState(initialData?.url || '')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Get current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Name ist erforderlich'
    } else if (name.length > 200) {
      newErrors.name = 'Der Name muss weniger als 200 Zeichen lang sein'
    }

    if (!url.trim()) {
      newErrors.url = 'URL ist erforderlich'
    } else {
      try {
        new URL(url)
      } catch {
        newErrors.url = 'Bitte geben Sie eine gültige URL ein'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)

    try {
      const data = { name: name.trim(), url: url.trim() }

      if (initialData?.id) {
        // Update existing dashboard
        const { error } = await supabase
          .from('dashboards')
          // @ts-ignore - Supabase types not available with placeholder env vars
          .update(data)
          .eq('id', initialData.id)
          .eq('user_id', user.id)

        if (error) throw error

        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/')
        }
      } else {
        // Create new dashboard
        if (!user) {
          throw new Error('Sie müssen angemeldet sein, um ein Dashboard zu erstellen')
        }

        const { error } = await supabase
          .from('dashboards')
          // @ts-ignore - Supabase types not available with placeholder env vars
          .insert({ ...data, user_id: user.id })

        if (error) throw error

        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/')
        }
      }
    } catch (error: any) {
      setErrors({ submit: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-slate-700">
          Dashboard-Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-[8px] border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
          placeholder="z.B. Vertriebs-Dashboard"
          required
        />
        {errors.name && (
          <p className="mt-1 text-sm text-rose-600">{errors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="url" className="block text-sm font-semibold text-slate-700">
          Dashboard-URL
        </label>
        <input
          type="url"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-[8px] border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
          placeholder="https://lookerstudio.google.com/..."
          required
        />
        {errors.url && (
          <p className="mt-1 text-sm text-rose-600">{errors.url}</p>
        )}
        <p className="mt-1 text-sm text-slate-500">
          Geben Sie die vollständige URL Ihres Google Looker Studio-Dashboards ein
        </p>
      </div>

      {errors.submit && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-[8px]">
          <p className="text-rose-700">{errors.submit}</p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="submit"
          className="btn btn-primary inline-flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading ? 'Wird gespeichert...' : (initialData?.id ? 'Dashboard aktualisieren' : 'Dashboard erstellen')}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary inline-flex items-center justify-center"
          disabled={loading}
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}

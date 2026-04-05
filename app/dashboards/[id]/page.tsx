'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'

interface Dashboard {
  id: string
  name: string
  url: string
  created_at: string
}

interface CheckResult {
  id: string
  timestamp: string
  overall_status: 'ok' | 'error'
  page_results: PageResult[]
}

interface PageResult {
  id: string
  page_name: string | null
  page_number: number | null
  page_url?: string | null
  status: 'ok' | 'error'
  error_description: string | null
  screenshot_url: string | null
}

export default function DashboardDetailPage() {
  const params = useParams()
  const dashboardId = params.id as string

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [checkResults, setCheckResults] = useState<CheckResult[]>([])
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState('')

  useEffect(() => {
    if (dashboardId) {
      fetchDashboard()
      fetchCheckResults()
    }
  }, [dashboardId])

  // Auto-expand first check if it has errors
  useEffect(() => {
    if (checkResults.length > 0 && !expandedCheckId) {
      const firstCheck = checkResults[0]
      if (firstCheck.overall_status === 'error') {
        setExpandedCheckId(firstCheck.id)
      }
    }
  }, [checkResults])

  const fetchDashboard = async () => {
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        // @ts-ignore - Supabase types not available with placeholder env vars
        .eq('id', dashboardId)
        .single()

      if (error) throw error
      setDashboard(data)
    } catch (error: any) {
      setError(error.message)
    }
  }

  const fetchCheckResults = async () => {
    try {
      const { data, error } = await supabase
        .from('check_results')
        .select(`
          id,
          timestamp,
          overall_status,
          page_results (
            id,
            page_name,
            page_number,
            status,
            error_description,
            screenshot_url
          )
        `)
        // @ts-ignore - Supabase types not available with placeholder env vars
        .eq('dashboard_id', dashboardId)
        .order('timestamp', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Fetch error:', error)
        // Fallback: Show message instead of crash
        if (error.message?.includes('page_url')) {
          setError('Database schema update in progress. Please refresh in a moment.')
          return
        }
        throw error
      }
      console.log('Check results fetched:', data)
      setCheckResults(data || [])
    } catch (error: any) {
      setError(error.message)
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const triggerManualCheck = async () => {
    setChecking(true)
    setCheckMessage('')

    try {
      let accessToken: string | null = null

      // Method 1: Try to get session from Supabase auth state
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('getSession() result:', { hasSession: !!session, hasToken: !!session?.access_token, error: sessionError?.message })
      
      if (session?.access_token) {
        const token = session.access_token
        accessToken = token
        console.log('✅ Token from getSession:', token.substring(0, 20) + '...')
      } else {
        console.warn('getSession returned no token, trying localStorage fallback')
        
        // Method 2: Fallback to localStorage if session method fails
        // Supabase stores auth data in localStorage under pattern: sb-{projectId}-auth.json
        try {
          const authKeys = Object.keys(typeof window !== 'undefined' ? window.localStorage : {})
          console.log('localStorage keys:', authKeys)
          const authKey = authKeys.find(k => k.includes('-auth.json'))
          console.log('Found auth key:', authKey)
          
          if (authKey) {
            const authData = JSON.parse(localStorage.getItem(authKey) || '{}')
            console.log('Auth data parsed:', { hasSession: !!authData.session, hasToken: !!authData.session?.access_token })
            const authToken = authData.session?.access_token
            if (authToken) {
              accessToken = authToken
              console.log('✅ Token from localStorage:', authToken.substring(0, 20) + '...')
            }
          }
        } catch (e) {
          console.warn('Failed to parse localStorage auth:', e)
        }
      }

      if (!accessToken) {
        throw new Error('No active session. Please sign in and try again.')
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }

      console.log('Sending check request with Bearer token header...')
      const response = await fetch('/api/checks', {
        method: 'POST',
        headers,
        credentials: 'include', // Send cookies with request
        body: JSON.stringify({ dashboardId }),
      })

      console.log('Check response:', { status: response.status, ok: response.ok })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Check failed')
      }

      setCheckMessage('✅ Check completed successfully! Refreshing results...')

      // Refresh check results
      await new Promise(resolve => setTimeout(resolve, 1000))
      await fetchCheckResults()

      setCheckMessage('')
    } catch (err: any) {
      console.error('Check error:', err)
      setCheckMessage(`❌ Check failed: ${err.message}`)
      setTimeout(() => setCheckMessage(''), 5000)
    } finally {
      setChecking(false)
    }
  }

  const getStatusIcon = (status: 'ok' | 'error') => {
    return status === 'ok'
      ? <CheckCircle className="w-5 h-5 text-emerald-600" />
      : <XCircle className="w-5 h-5 text-rose-600" />
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4F46E5]"></div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] py-12 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="card-base p-6 border-rose-200 bg-rose-50">
            <p className="text-rose-700 font-medium">{error || 'Dashboard not found'}</p>
            <Link
              href="/"
              className="mt-4 inline-flex text-[#4F46E5] hover:text-[#4338CA]"
            >
              ← Back to dashboards
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] py-12 px-4">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="card-base p-6">
          <Link
            href="/"
            className="inline-flex items-center text-[#4F46E5] hover:text-[#4338CA] mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to dashboards
          </Link>

          <div className="md:flex md:items-start md:justify-between md:gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">{dashboard.name}</h1>
              <a
                href={dashboard.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#4F46E5] hover:text-[#4338CA] mt-3 text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="truncate max-w-3xl">{dashboard.url}</span>
              </a>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={triggerManualCheck}
                disabled={checking}
                className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Checking...' : 'Check Now'}
              </button>
              <Link
                href={`/dashboards/${dashboard.id}/edit`}
                className="btn btn-secondary inline-flex items-center justify-center"
              >
                Edit Dashboard
              </Link>
            </div>
          </div>
        </div>

        {checkMessage && (
          <div className={`p-4 rounded-[8px] mb-6 ${
            checkMessage.startsWith('✅')
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {checkMessage}
          </div>
        )}

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4F46E5]">Audit history</p>
            <h2 className="text-2xl font-bold text-slate-950 mt-2">Check History</h2>
          </div>

          {checkResults.length === 0 ? (
            <div className="card-base p-10 text-center text-slate-600">
              No checks performed yet
            </div>
          ) : (
            <div className="space-y-4">
              {checkResults.map((check) => (
                <div
                  key={check.id}
                  className={`card-base overflow-hidden border-2 ${
                    check.overall_status === 'ok'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-rose-200 bg-rose-50'
                  }`}
                >
                  <div className={`p-6 border-b ${check.overall_status === 'ok' ? 'border-emerald-200 bg-white' : 'border-rose-200 bg-white'}`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(check.overall_status)}
                        <div>
                          <p className="text-xl font-bold text-slate-950">
                            {check.overall_status === 'ok' ? 'All pages passed' : 'Some pages have errors'}
                          </p>
                          {check.page_results && (
                            <span className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                              {check.page_results.filter(p => p.status === 'ok').length}/{check.page_results.length} pages OK
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-slate-600">
                        {new Date(check.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {!check.page_results || check.page_results.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No page results available
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {check.page_results.map((page, index) => (
                          <div
                            key={page.id}
                            className={`rounded-[8px] border p-4 ${
                              page.status === 'ok'
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-rose-200 bg-rose-50'
                            }`}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(page.status)}
                                  <div>
                                    <p className="text-lg font-bold text-slate-950">
                                      {page.page_name || `Page ${page.page_number || index + 1}`}
                                    </p>
                                    <p className={`text-sm font-semibold ${page.status === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                      {page.status === 'ok' ? 'Status: OK' : 'Status: ERROR'}
                                    </p>
                                  </div>
                                </div>

                                {page.page_url && (
                                  <div className="rounded-[8px] border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">URL</p>
                                    <a
                                      href={page.page_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#4F46E5] hover:text-[#4338CA] text-sm break-words font-mono"
                                    >
                                      {page.page_url}
                                    </a>
                                  </div>
                                )}

                                {page.status === 'error' && page.error_description && (
                                  <div className="rounded-[8px] border border-rose-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 mb-2">Error details</p>
                                    <div className="text-sm text-rose-900 whitespace-pre-wrap font-mono">
                                      {page.error_description}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {page.screenshot_url && (
                                <div className="mt-4 sm:mt-0">
                                  <a
                                    href={page.screenshot_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-[8px] bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338CA]"
                                  >
                                    📸 View Screenshot
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
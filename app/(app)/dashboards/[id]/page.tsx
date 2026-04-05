'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CheckCircle,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import type { CheckStreamLine } from '@/lib/checks/checkProgress'
import { supabase } from '@/lib/supabase/client'

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
  const [expandedCheckIds, setExpandedCheckIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState('')
  const [checkStatusLine, setCheckStatusLine] = useState('')
  const [checkLog, setCheckLog] = useState<string[]>([])
  const [checkFraction, setCheckFraction] = useState<{
    current: number
    total: number
  } | null>(null)

  useEffect(() => {
    if (dashboardId) {
      fetchDashboard()
      fetchCheckResults()
    }
  }, [dashboardId])

  const toggleCheckExpanded = (checkId: string) => {
    setExpandedCheckIds((prev) => {
      const next = new Set(prev)
      if (next.has(checkId)) next.delete(checkId)
      else next.add(checkId)
      return next
    })
  }

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
        if (error.message?.includes('page_url')) {
          setError('Datenbankschema-Update wird durchgeführt. Bitte aktualisieren Sie in einem Moment.')
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
    setCheckStatusLine('Check wird gestartet ...')
    setCheckLog([])
    setCheckFraction(null)

    try {
      let accessToken: string | null = null

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('getSession() result:', { hasSession: !!session, hasToken: !!session?.access_token, error: sessionError?.message })

      if (session?.access_token) {
        accessToken = session.access_token
        console.log('Token from getSession:', accessToken.substring(0, 20) + '...')
      } else {
        console.warn('getSession returned no token, trying localStorage fallback')
        try {
          const authKeys = Object.keys(typeof window !== 'undefined' ? window.localStorage : {})
          const authKey = authKeys.find((key) => key.includes('-auth.json'))
          if (authKey) {
            const authData = JSON.parse(localStorage.getItem(authKey) || '{}')
            const authToken = authData.session?.access_token
            if (authToken) {
              accessToken = authToken
              console.log('Token from localStorage:', authToken.substring(0, 20) + '...')
            }
          }
        } catch (e) {
          console.warn('Failed to parse localStorage auth:', e)
        }
      }

      if (!accessToken) {
        throw new Error('Keine aktive Sitzung. Bitte melden Sie sich an und versuchen Sie es erneut.')
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        Authorization: `Bearer ${accessToken}`,
      }

      const response = await fetch('/api/checks', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ dashboardId, stream: true }),
      })

      console.log('Check response:', { status: response.status, ok: response.ok })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'Check fehlgeschlagen')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Streaming nicht verfugbar')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let sawComplete = false

      const handleEvent = async (ev: CheckStreamLine) => {
        if (ev.type === 'progress') {
          setCheckStatusLine(ev.message)
          setCheckLog((prev) => [...prev.slice(-7), ev.message])
          if (ev.progress) {
            setCheckFraction(ev.progress)
          }
          return
        }
        if (ev.type === 'error') {
          throw new Error(ev.message)
        }
        if (ev.type === 'complete' && ev.success) {
          sawComplete = true
          setCheckStatusLine('Fertig.')
          setCheckMessage('Check abgeschlossen. Aktualisiere Verlauf ...')
          await new Promise((resolve) => setTimeout(resolve, 600))
          await fetchCheckResults()
          setCheckMessage('')
          setCheckLog([])
          setCheckFraction(null)
          setCheckStatusLine('')
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const ev = JSON.parse(trimmed) as CheckStreamLine
            await handleEvent(ev)
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      const tail = buffer.trim()
      if (tail) {
        try {
          const ev = JSON.parse(tail) as CheckStreamLine
          await handleEvent(ev)
        } catch (e) {
          if (!(e instanceof SyntaxError)) {
            throw e
          }
        }
      }

      if (!sawComplete) {
        await fetchCheckResults()
      }
    } catch (err: unknown) {
      console.error('Check error:', err)
      const msg = err instanceof Error ? err.message : 'Check fehlgeschlagen'
      setCheckMessage(`Check fehlgeschlagen: ${msg}`)
      setCheckStatusLine('')
      setCheckLog([])
      setCheckFraction(null)
      setTimeout(() => setCheckMessage(''), 8000)
    } finally {
      setChecking(false)
    }
  }

  const getStatusIcon = (status: 'ok' | 'error') => {
    return status === 'ok'
      ? <CheckCircle className="h-5 w-5 text-emerald-600" />
      : <XCircle className="h-5 w-5 text-rose-600" />
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full border-b-2 border-[#4F46E5] h-10 w-10" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card-base border-rose-200 bg-rose-50 p-6">
          <p className="font-medium text-rose-700">{error || 'Dashboard nicht gefunden'}</p>
          <Link href="/" className="focus-ring mt-4 inline-flex rounded-[6px] text-[#4F46E5] hover:text-[#4338CA]">
            Zurück zu Dashboards
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card-base p-6 sm:p-8">
        <Breadcrumbs
          items={[
            { label: 'Dashboards', href: '/' },
            { label: dashboard.name },
          ]}
        />

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">{dashboard.name}</h1>
            <a
              href={dashboard.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring mt-3 inline-flex max-w-3xl items-center gap-2 rounded-[8px] text-sm text-[#4F46E5] hover:text-[#4338CA]"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">{dashboard.url}</span>
            </a>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={triggerManualCheck}
              disabled={checking}
              className="btn btn-primary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Prüfung läuft...' : 'Jetzt prüfen'}
            </button>
            <Link
              href={`/dashboards/${dashboard.id}/edit`}
              className="btn btn-secondary inline-flex items-center justify-center"
            >
              Dashboard bearbeiten
            </Link>
          </div>
        </div>
      </section>

      {checking && (
        <div className="card-base space-y-4 border-2 border-[#4F46E5]/30 bg-white p-5">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-[#4F46E5]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4F46E5]">
                Check läuft
              </p>
              <p className="mt-1 text-base font-medium text-slate-900">
                {checkStatusLine || 'Bitte warten ...'}
              </p>
              {checkFraction && checkFraction.total > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-600">
                    <span>Fortschritt</span>
                    <span>
                      {checkFraction.current} / {checkFraction.total} Seiten
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[#4F46E5] transition-[width] duration-300 ease-out"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((checkFraction.current / checkFraction.total) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          {checkLog.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-[8px] border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Verlauf
              </p>
              <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700">
                {checkLog.map((line, index) => (
                  <li key={`${index}-${line.slice(0, 24)}`} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {checkMessage && !checking && (
        <div
          className={`rounded-[8px] p-4 ${
            checkMessage.startsWith('Check abgeschlossen')
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {checkMessage}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4F46E5]">Audit-Verlauf</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Prüfverlauf</h2>
        </div>

        {checkResults.length === 0 ? (
          <div className="card-base p-10 text-center text-slate-600">Noch keine Prüfungen durchgeführt</div>
        ) : (
          <div className="space-y-4">
            {checkResults.map((check) => {
              const isExpanded = expandedCheckIds.has(check.id)
              return (
                <div
                  key={check.id}
                  className={`card-base overflow-hidden border-2 ${
                    check.overall_status === 'ok'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-rose-200 bg-rose-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCheckExpanded(check.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Details einklappen' : 'Details ausklappen'}
                    className={`w-full p-6 text-left transition-colors hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 ${
                      check.overall_status === 'ok' ? 'border-emerald-200 bg-white' : 'border-rose-200 bg-white'
                    } ${isExpanded ? `border-b ${check.overall_status === 'ok' ? 'border-emerald-200' : 'border-rose-200'}` : ''}`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <ChevronDown
                          className={`mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          aria-hidden
                        />
                        {getStatusIcon(check.overall_status)}
                        <div className="min-w-0">
                          <p className="text-xl font-bold text-slate-950">
                            {check.overall_status === 'ok' ? 'Alle Seiten bestanden' : 'Einige Seiten weisen Fehler auf'}
                          </p>
                          {check.page_results && (
                            <span className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                              {check.page_results.filter((page) => page.status === 'ok').length}/{check.page_results.length}{' '}
                              Seiten OK
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm text-slate-600 md:text-right">
                        {new Date(check.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="space-y-4 p-6">
                      {!check.page_results || check.page_results.length === 0 ? (
                        <div className="py-8 text-center text-slate-500">Keine Seitenergebnisse verfügbar</div>
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
                                        {page.page_name || `Seite ${page.page_number || index + 1}`}
                                      </p>
                                      <p
                                        className={`text-sm font-semibold ${
                                          page.status === 'ok' ? 'text-emerald-700' : 'text-rose-700'
                                        }`}
                                      >
                                        {page.status === 'ok' ? 'Status: OK' : 'Status: ERROR'}
                                      </p>
                                    </div>
                                  </div>

                                  {page.page_url && (
                                    <div className="rounded-[8px] border border-slate-200 bg-white p-4">
                                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                        URL
                                      </p>
                                      <a
                                        href={page.page_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="focus-ring break-words rounded-[6px] font-mono text-sm text-[#4F46E5] hover:text-[#4338CA]"
                                      >
                                        {page.page_url}
                                      </a>
                                    </div>
                                  )}

                                  {page.status === 'error' && page.error_description && (
                                    <div className="rounded-[8px] border border-rose-200 bg-white p-4">
                                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
                                        Fehlerdetails
                                      </p>
                                      <div className="whitespace-pre-wrap font-mono text-sm text-rose-900">
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
                                      className="focus-ring inline-flex items-center gap-2 rounded-[8px] bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338CA]"
                                    >
                                      Screenshot ansehen
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

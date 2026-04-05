import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dashboardChecker } from '@/lib/checks/dashboardChecker'
import { processCheckResult } from '@/lib/checks/resultProcessor'
import type { CheckProgressPayload } from '@/lib/checks/checkProgress'

export const maxDuration = 300
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration incomplete' },
        { status: 500 }
      )
    }

    let sessionToken = null
    let user: any = null

    const authHeader = request.headers.get('authorization')
    console.log('Auth header received:', authHeader ? 'YES' : 'NO')

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      console.log('Bearer token found, length:', token.length)

      try {
        const verifyUrl = `${supabaseUrl}/auth/v1/user`
        const verifyResponse = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
          },
        })

        if (verifyResponse.ok) {
          user = await verifyResponse.json()
          console.log(`✅ Token verified! User ID: ${user.id}`)
        } else {
          const errorData = await verifyResponse.text()
          console.error('Token verification failed. Response:', errorData)
        }
      } catch (e) {
        console.error('Bearer token verification error:', e)
      }
    } else {
      console.warn('No Bearer token found in Authorization header')
    }

    if (!user) {
      const cookieHeader = request.headers.get('cookie') || ''

      const cookies = cookieHeader.split(';').reduce((acc: any, cookie: string) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = decodeURIComponent(value)
        return acc
      }, {})

      for (const [key, value] of Object.entries(cookies)) {
        if (key.includes('-auth-token')) {
          sessionToken = value as string
          break
        }
      }

      if (sessionToken) {
        try {
          const session = JSON.parse(sessionToken)
          if (session.user) {
            user = session.user
          }
        } catch (e) {
          console.error('Failed to parse session token:', e)
        }
      }
    }

    if (!user || !user.id) {
      console.error('No valid authentication found')
      return NextResponse.json(
        { error: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    let body: { dashboardId?: string; stream?: boolean }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { dashboardId, stream } = body

    if (!dashboardId) {
      return NextResponse.json(
        { error: 'Dashboard ID is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: dashboard, error: dashboardError } = await supabaseAdmin
      .from('dashboards')
      .select('id, url')
      .eq('id', dashboardId)
      .eq('user_id', user.id)
      .single()

    if (dashboardError || !dashboard) {
      console.error('Dashboard error:', dashboardError)
      return NextResponse.json(
        { error: 'Dashboard not found or access denied' },
        { status: 404 }
      )
    }

    console.log(`Manually checking dashboard ${dashboardId}: ${dashboard.url}`)

    if (stream) {
      const encoder = new TextEncoder()

      const readable = new ReadableStream({
        async start(controller) {
          const sendProgress = (payload: CheckProgressPayload) => {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: 'progress', ts: Date.now(), ...payload }) + '\n'
              )
            )
          }

          try {
            const checkResult = await dashboardChecker.checkDashboard(dashboard.url, {
              onProgress: sendProgress,
            })

            sendProgress({
              phase: 'saving',
              message: 'Ergebnisse werden in der Datenbank gespeichert …',
            })

            const processedResult = await processCheckResult(
              dashboardId,
              checkResult,
              supabaseAdmin
            )

            await dashboardChecker.close()

            console.log(
              `Manual check completed (stream) for dashboard ${dashboardId}: ${processedResult.overallStatus}`
            )

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'complete',
                  success: true,
                  result: {
                    checkId: processedResult.checkId,
                    status: processedResult.overallStatus,
                    timestamp: processedResult.timestamp,
                    pageResults: processedResult.pageResults,
                  },
                }) + '\n'
              )
            )
          } catch (err: unknown) {
            console.error('Check stream error:', err)
            try {
              await dashboardChecker.close()
            } catch {
              /* ignore */
            }
            const message =
              err instanceof Error ? err.message : 'Check failed'
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'error', message }) + '\n')
            )
          } finally {
            controller.close()
          }
        },
      })

      return new NextResponse(readable, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    const checkResult = await dashboardChecker.checkDashboard(dashboard.url)

    const processedResult = await processCheckResult(
      dashboardId,
      checkResult,
      supabaseAdmin
    )

    await dashboardChecker.close()

    console.log(
      `Manual check completed for dashboard ${dashboardId}: ${processedResult.overallStatus}`
    )

    return NextResponse.json({
      success: true,
      result: {
        checkId: processedResult.checkId,
        status: processedResult.overallStatus,
        timestamp: processedResult.timestamp,
        pageResults: processedResult.pageResults,
      },
    })
  } catch (error: any) {
    console.error('Check error:', error)
    return NextResponse.json(
      { error: 'Check failed: ' + error.message },
      { status: 500 }
    )
  }
}

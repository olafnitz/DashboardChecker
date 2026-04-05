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

    let body: { dashboardId?: string; stream?: boolean; resumeCheckId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { dashboardId, stream, resumeCheckId } = body

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
            let activeCheckId = resumeCheckId
            let existingPages: any[] = []

            if (activeCheckId) {
              const { data } = await supabaseAdmin.from('page_results').select('*').eq('check_result_id', activeCheckId)
              if (data) existingPages = data
              await supabaseAdmin.from('check_results').update({ overall_status: 'running' }).eq('id', activeCheckId)
            } else {
              const { data: newCheck } = await supabaseAdmin.from('check_results').insert({ dashboard_id: dashboardId, overall_status: 'running', completed_pages: 0 }).select().single()
              activeCheckId = newCheck?.id
            }

            const checkResult = await dashboardChecker.checkDashboard(dashboard.url, {
              onProgress: sendProgress,
              existingPageResults: existingPages.map(p => ({
                 pageName: p.page_name, pageNumber: p.page_number, status: p.status, errorDescription: p.error_description
              })),
              onPagesDetected: async (pages) => {
                 if (activeCheckId) {
                   await supabaseAdmin.from('check_results').update({ total_pages: pages.length }).eq('id', activeCheckId)
                 }
              },
              onPageTested: async (pageResult) => {
                 if (activeCheckId) {
                   await supabaseAdmin.from('page_results').insert({
                     check_result_id: activeCheckId,
                     page_name: pageResult.pageName,
                     page_number: pageResult.pageNumber,
                     page_url: pageResult.pageUrl,
                     status: pageResult.status,
                     error_description: pageResult.errorDescription
                   })
                 }
              }
            })

            sendProgress({
              phase: 'saving',
              message: 'Check beendet. Finaler Status wird gespeichert …',
            })

            const finalStatus = checkResult.pageResults.some(r => r.status === 'error') ? 'error' : 'ok'
            if (activeCheckId) {
              await supabaseAdmin.from('check_results').update({ overall_status: finalStatus }).eq('id', activeCheckId)
            }

            await dashboardChecker.close()

            console.log(
              `Manual check completed (stream) for dashboard ${dashboardId}: ${finalStatus}`
            )

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'complete',
                  success: true,
                  result: {
                    checkId: activeCheckId,
                    status: finalStatus,
                    timestamp: new Date().toISOString(),
                    pageResults: checkResult.pageResults,
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

    let activeCheckId = resumeCheckId
    let existingPages: any[] = []

    if (activeCheckId) {
      const { data } = await supabaseAdmin.from('page_results').select('*').eq('check_result_id', activeCheckId)
      if (data) existingPages = data
      await supabaseAdmin.from('check_results').update({ overall_status: 'running' }).eq('id', activeCheckId)
    } else {
      const { data: newCheck } = await supabaseAdmin.from('check_results').insert({ dashboard_id: dashboardId, overall_status: 'running', completed_pages: 0 }).select().single()
      activeCheckId = newCheck?.id
    }

    const checkResult = await dashboardChecker.checkDashboard(dashboard.url, {
      existingPageResults: existingPages.map(p => ({
         pageName: p.page_name, pageNumber: p.page_number, status: p.status, errorDescription: p.error_description
      })),
      onPagesDetected: async (pages) => {
         if (activeCheckId) {
           await supabaseAdmin.from('check_results').update({ total_pages: pages.length }).eq('id', activeCheckId)
         }
      },
      onPageTested: async (pageResult) => {
         if (activeCheckId) {
           await supabaseAdmin.from('page_results').insert({
             check_result_id: activeCheckId,
             page_name: pageResult.pageName,
             page_number: pageResult.pageNumber,
             page_url: pageResult.pageUrl,
             status: pageResult.status,
             error_description: pageResult.errorDescription
           })
         }
      }
    })

    const finalStatus = checkResult.pageResults.some(r => r.status === 'error') ? 'error' : 'ok'
    if (activeCheckId) {
      await supabaseAdmin.from('check_results').update({ overall_status: finalStatus }).eq('id', activeCheckId)
    }

    await dashboardChecker.close()

    console.log(
      `Manual check completed for dashboard ${dashboardId}: ${finalStatus}`
    )

    return NextResponse.json({
      success: true,
      result: {
        checkId: activeCheckId,
        status: finalStatus,
        timestamp: new Date().toISOString(),
        pageResults: checkResult.pageResults,
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

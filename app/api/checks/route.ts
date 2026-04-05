import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dashboardChecker } from '@/lib/checks/dashboardChecker'
import { processCheckResult } from '@/lib/checks/resultProcessor'

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

    // Method 1: Check Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization')
    console.log('Auth header received:', authHeader ? 'YES' : 'NO')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7) // Remove "Bearer " prefix
      console.log('Bearer token found, length:', token.length)
      
      try {
        // Verify token by calling Supabase REST API directly
        const verifyUrl = `${supabaseUrl}/auth/v1/user`
        console.log('Calling Supabase API to verify token at:', verifyUrl)
        
        const verifyResponse = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseAnonKey,
          },
        })

        console.log('Supabase verification response status:', verifyResponse.status)

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

    // Method 2: Fallback to cookies if no Authorization header or token failed
    if (!user) {
      const cookieHeader = request.headers.get('cookie') || ''

      // Parse cookies
      const cookies = cookieHeader.split(';').reduce((acc: any, cookie: string) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = decodeURIComponent(value)
        return acc
      }, {})

      // Find the auth token cookie
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

    const { dashboardId } = await request.json()

    if (!dashboardId) {
      return NextResponse.json(
        { error: 'Dashboard ID is required' },
        { status: 400 }
      )
    }

    // Use service role to verify ownership and run checks
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

    // Perform the check
    const checkResult = await dashboardChecker.checkDashboard(dashboard.url)

    // Process and store the result using service role
    const processedResult = await processCheckResult(dashboardId, checkResult, supabaseAdmin)

    // Clean up browser
    await dashboardChecker.close()

    console.log(`Manual check completed for dashboard ${dashboardId}: ${processedResult.overallStatus}`)

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
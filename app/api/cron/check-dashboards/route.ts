import { NextRequest, NextResponse } from 'next/server'
import { dashboardChecker } from '@/lib/checks/dashboardChecker'
import { processCheckResult, getAllDashboardsForChecking } from '@/lib/checks/resultProcessor'

// Cron must run only on request — never during `next build` (Playwright / DB are not available there).
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    console.log('Starting dashboard check cron job')

    // Get all dashboards to check
    const dashboards = await getAllDashboardsForChecking()

    if (dashboards.length === 0) {
      console.log('No dashboards to check')
      return NextResponse.json({ success: true, message: 'No dashboards to check' })
    }

    console.log(`Checking ${dashboards.length} dashboards`)

    const results = []

    // Check each dashboard
    for (const dashboard of dashboards) {
      try {
        console.log(`Checking dashboard ${dashboard.id}: ${dashboard.url}`)

        // Perform the check
        const checkResult = await dashboardChecker.checkDashboard(dashboard.url)

        // Process and store the result
        const processedResult = await processCheckResult(dashboard.id, checkResult)

        results.push({
          dashboardId: dashboard.id,
          status: processedResult.overallStatus,
          pagesChecked: processedResult.pageResults.length,
        })

        console.log(`Dashboard ${dashboard.id} check completed: ${processedResult.overallStatus}`)

      } catch (error) {
        console.error(`Failed to check dashboard ${dashboard.id}:`, error)
        results.push({
          dashboardId: dashboard.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Clean up browser instance
    await dashboardChecker.close()

    const successCount = results.filter(r => r.status === 'ok').length
    const errorCount = results.filter(r => r.status === 'error').length

    console.log(`Cron job completed: ${successCount} successful, ${errorCount} failed`)

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: errorCount,
      },
    })

  } catch (error) {
    console.error('Cron job failed:', error)

    // Ensure browser is closed even on error
    try {
      await dashboardChecker.close()
    } catch (closeError) {
      console.error('Failed to close browser:', closeError)
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Vercel Cron Job configuration
// This endpoint should be called daily at 06:00 UTC
// Configure in vercel.json:
// {
//   "crons": [
//     {
//       "path": "/api/cron/check-dashboards",
//       "schedule": "0 6 * * *"
//     }
//   ]
// }
import { DashboardCheckResult, PageCheckResult } from './dashboardChecker'
import { uploadScreenshot } from './screenshotCapture'
import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

export interface ProcessedCheckResult {
  checkId: string
  overallStatus: 'ok' | 'error'
  pageResults: ProcessedPageResult[]
  timestamp: string
}

export interface ProcessedPageResult extends PageCheckResult {
  screenshotUrl?: string
}

export async function processCheckResult(
  dashboardId: string,
  checkResult: DashboardCheckResult,
  adminClient?: any
): Promise<ProcessedCheckResult> {
  // If adminClient provided, use it. Otherwise, create a new service role client
  let client = adminClient
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase configuration missing for processCheckResult')
    }
    client = createClient(supabaseUrl, supabaseServiceRoleKey)
  }
  try {
    // Create check result record
    const { data: checkData, error: checkError } = await client
      .from('check_results')
      .insert({
        dashboard_id: dashboardId,
        overall_status: checkResult.overallStatus,
      })
      .select()
      .single()

    if (checkError) {
      throw new Error(`Failed to create check result: ${checkError.message}`)
    }

    const checkId = checkData.id

    // Process each page result
    const processedPageResults: ProcessedPageResult[] = []

    for (const pageResult of checkResult.pageResults) {
      let screenshotUrl: string | undefined

      // Upload screenshot if there was an error and we have screenshot data
      if (pageResult.status === 'error' && pageResult.screenshotUrl) {
        try {
          // In a real implementation, we'd have the screenshot buffer here
          // For now, we'll skip the actual upload since we don't have the buffer
          // screenshotUrl = await uploadScreenshot(
          //   screenshotBuffer,
          //   dashboardId,
          //   checkId,
          //   pageResult.pageName || `page-${pageResult.pageNumber}`
          // )
        } catch (error) {
          console.error('Screenshot upload failed:', error)
        }
      }

      // Create page result record
      const { error: pageError } = await client
        .from('page_results')
        .insert({
          check_result_id: checkId,
          page_name: pageResult.pageName,
          page_number: pageResult.pageNumber,
          page_url: pageResult.pageUrl,
          status: pageResult.status,
          error_description: pageResult.errorDescription,
          screenshot_url: screenshotUrl,
        })

      if (pageError) {
        console.error(`Failed to create page result for ${pageResult.pageName}:`, pageError)
        // Continue processing other pages
      }

      processedPageResults.push({
        ...pageResult,
        screenshotUrl,
      })
    }

    return {
      checkId,
      overallStatus: checkResult.overallStatus,
      pageResults: processedPageResults,
      timestamp: checkData.timestamp || new Date().toISOString(),
    }

  } catch (error) {
    console.error('Failed to process check result:', error)
    throw error
  }
}

export async function getDashboardCheckHistory(
  dashboardId: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Supabase configuration missing for getDashboardCheckHistory')
      return []
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

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
      .eq('dashboard_id', dashboardId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch check history: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error('Failed to get dashboard check history:', error)
    throw error
  }
}

export async function getAllDashboardsForChecking(): Promise<Array<{ id: string; url: string }>> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Supabase configuration missing for getAllDashboardsForChecking')
      return []
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data, error } = await supabase
      .from('dashboards')
      .select('id, url')

    if (error) {
      throw new Error(`Failed to fetch dashboards: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error('Failed to get dashboards for checking:', error)
    throw error
  }
}
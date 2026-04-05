import { createClient } from '@supabase/supabase-js'

export async function uploadScreenshot(
  screenshotBuffer: Buffer,
  dashboardId: string,
  checkId: string,
  pageName: string
): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase configuration missing for screenshot upload')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `screenshot-${dashboardId}-${checkId}-${pageName}-${timestamp}.png`

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('screenshots')
      .upload(filename, screenshotBuffer, {
        contentType: 'image/png',
        cacheControl: '3600', // 1 hour
      })

    if (error) {
      console.error('Screenshot upload error:', error)
      throw new Error(`Failed to upload screenshot: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('screenshots')
      .getPublicUrl(filename)

    if (!urlData.publicUrl) {
      throw new Error('Failed to get screenshot public URL')
    }

    return urlData.publicUrl
  } catch (error) {
    console.error('Screenshot upload failed:', error)
    // Return empty string on failure - check can still proceed
    return ''
  }
}

export async function cleanupOldScreenshots(daysOld: number = 30): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.warn('Supabase configuration missing for screenshot cleanup')
      return
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get list of files older than specified days
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('screenshots')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      })

    if (listError) {
      console.error('Failed to list screenshots:', listError)
      return
    }

    if (!files || files.length === 0) return

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const oldFiles = files.filter(file => {
      if (!file.created_at) return false
      const fileDate = new Date(file.created_at)
      return fileDate < cutoffDate
    })

    if (oldFiles.length === 0) return

    // Delete old files
    const fileNames = oldFiles.map(file => file.name)
    const { error: deleteError } = await supabaseAdmin.storage
      .from('screenshots')
      .remove(fileNames)

    if (deleteError) {
      console.error('Failed to delete old screenshots:', deleteError)
    } else {
      console.log(`Cleaned up ${fileNames.length} old screenshots`)
    }
  } catch (error) {
    console.error('Screenshot cleanup failed:', error)
  }
}
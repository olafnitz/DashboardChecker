import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Browser-only singleton - initialized once and locked
let browserClientInstance: ReturnType<typeof createClient> | null = null

// Initialize browser client immediately on module load (browser only)
function initializeBrowserClient() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!browserClientInstance) {
    browserClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Enable automatic session persistence to localStorage and cookies
        persistSession: true,
        // Detect session from URL fragment (for OAuth redirects)
        detectSessionInUrl: true,
        // Store session in localStorage AND cookies for SSR compatibility
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  }

  return browserClientInstance
}

// Get the singleton browser client
export function getSupabase() {
  if (typeof window === 'undefined') {
    // Server-side - always create new instance
    return createClient(supabaseUrl, supabaseAnonKey)
  }

  // Client-side - return singleton
  return initializeBrowserClient()!
}

// Default export for backward compatibility - always returns the initialized singleton
export const supabase = initializeBrowserClient() || (() => {
  // Fallback for server-side rendering
  return createClient(supabaseUrl, supabaseAnonKey)
})()
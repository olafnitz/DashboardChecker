export type CheckProgressPhase =
  | 'starting'
  | 'browser_ready'
  | 'navigating'
  | 'dashboard_loaded'
  | 'detecting_pages'
  | 'pages_detected'
  | 'page_check_start'
  | 'page_check_done'
  | 'saving'
  | 'complete'
  | 'error'

/** Emitted from DashboardChecker; API wraps with type + ts for NDJSON stream */
export interface CheckProgressPayload {
  phase: CheckProgressPhase
  message: string
  progress?: { current: number; total: number }
  pageName?: string | null
  pageStatus?: 'ok' | 'error'
}

export type CheckStreamLine =
  | ({
      type: 'progress'
      ts: number
    } & CheckProgressPayload)
  | {
      type: 'complete'
      success: true
      result: {
        checkId: string
        status: 'ok' | 'error'
        timestamp: string
        pageResults: unknown[]
      }
    }
  | {
      type: 'error'
      message: string
    }

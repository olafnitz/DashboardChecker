import type { Browser, Page } from 'playwright-core'
import type { CheckProgressPayload } from '@/lib/checks/checkProgress'

export interface PageCheckResult {
  pageName: string | null
  pageNumber: number | null
  pageUrl?: string
  status: 'ok' | 'error'
  errorDescription?: string
  screenshotUrl?: string
}

export interface DashboardCheckResult {
  overallStatus: 'ok' | 'error'
  pageResults: PageCheckResult[]
}

export interface CheckDashboardOptions {
  onProgress?: (payload: CheckProgressPayload) => void
}

function localChromiumArgs(): string[] {
  const base = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--disable-gpu',
  ]
  // --single-process / --no-zygote break on some Windows setups
  if (process.platform !== 'win32') {
    base.push('--no-zygote', '--single-process')
  }
  return base
}

async function launchChromium(): Promise<Browser> {
  const { chromium } = await import('playwright-core')
  // Vercel / AWS-style serverless: bundled Playwright browsers are not present
  if (process.env.VERCEL) {
    const sparticuz = (await import('@sparticuz/chromium')).default
    return chromium.launch({
      args: [...sparticuz.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: await sparticuz.executablePath(),
      headless: true,
    })
  }

  return chromium.launch({
    headless: true,
    args: localChromiumArgs(),
  })
}

export class DashboardChecker {
  private browser: Browser | null = null

  async initialize() {
    if (!this.browser) {
      this.browser = await launchChromium()
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  async checkDashboard(
    dashboardUrl: string,
    options?: CheckDashboardOptions
  ): Promise<DashboardCheckResult> {
    const emit = options?.onProgress

    emit?.({
      phase: 'starting',
      message: 'Check wird vorbereitet …',
    })

    await this.initialize()

    if (!this.browser) {
      throw new Error('Browser not initialized')
    }

    emit?.({
      phase: 'browser_ready',
      message: 'Browser ist bereit.',
    })

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'DashboardChecker/1.0'
    })

    const page = await context.newPage()

    try {
      emit?.({
        phase: 'navigating',
        message:
          'Dashboard wird geladen (Looker Studio kann 15–30 Sekunden brauchen) …',
      })

      // Navigate to dashboard with shorter timeout
      // Use 'domcontentloaded' instead of 'networkidle' for faster loading
      try {
        await page.goto(dashboardUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        })
      } catch (e: any) {
        // If timeout, still try to work with what we have
        console.warn('Page navigation timeout, continuing with partial load:', e.message)
      }

      // Wait for Looker Studio to load
      await page.waitForTimeout(3000)

      emit?.({
        phase: 'dashboard_loaded',
        message: 'Bericht geladen, Seiten werden erkannt …',
      })

      emit?.({
        phase: 'detecting_pages',
        message: 'Navigation und Seitenliste werden ausgewertet …',
      })

      // Detect pages and their URLs
      const pages = await this.detectPagesWithUrls(page)

      console.log(`✅ Detected ${pages.length} pages in dashboard`)
      pages.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} - ${p.url}`)
      })

      emit?.({
        phase: 'pages_detected',
        message:
          pages.length === 1
            ? 'Eine Seite gefunden.'
            : `${pages.length} Seiten gefunden.`,
        progress: { current: 0, total: pages.length },
      })

      const pageResults: PageCheckResult[] = []
      
      // Check pages sequentially to prevent Looker Studio from failing under heavy parallel load
      const batchSize = 1
      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize)
        const batchPromises = batch.map(async (p, batchIdx) => {
          const globalIdx = i + batchIdx + 1
          
          emit?.({
            phase: 'page_check_start',
            message: `Seite ${globalIdx} von ${pages.length}: „${p.name}“ wird geprüft …`,
            progress: { current: globalIdx, total: pages.length },
            pageName: p.name,
          })

          // Create a new tab for this page to allow parallel checking
          const pageTab = await context.newPage()
          try {
            const pageResult = await this.checkPage(pageTab, p.name, globalIdx, p.url)
            
            emit?.({
              phase: 'page_check_done',
              message: pageResult.status === 'ok' ? `Seite ${globalIdx}: OK` : `Seite ${globalIdx}: Problem erkannt`,
              progress: { current: globalIdx, total: pages.length },
              pageName: p.name,
              pageStatus: pageResult.status,
            })
            
            return pageResult
          } finally {
            await pageTab.close()
          }
        })
        
        const results = await Promise.all(batchPromises)
        pageResults.push(...results)
      }

      // Determine overall status
      const overallStatus = pageResults.some(r => r.status === 'error') ? 'error' : 'ok'

      return {
        overallStatus,
        pageResults
      }

    } finally {
      await page.close()
      await context.close()
    }
  }

  private async detectPagesWithUrls(page: Page): Promise<Array<{ name: string; url: string }>> {
    console.log('🔍 [BACKEND] Extracting page URLs...')

    try {
      await page.waitForTimeout(3000)

      // Strategy 1: Check if xap-nav-menu exists (sidebar navigation)
      const hasXapNavMenu = await page.evaluate(() => !!document.querySelector('xap-nav-menu'))
      
      if (hasXapNavMenu) {
        console.log('🔍 [BACKEND] Detected xap-nav-menu navigation style')
        return this.detectPagesFromSidebarMenu(page)
      }

      // Strategy 2: Check if next/prev page buttons exist (pagination navigation)
      const hasNavButtons = await page.evaluate(() => {
        const next = document.querySelector('span[aria-label="Nächste Seite"], span.navBtn.nextBtn')
        const prev = document.querySelector('span[aria-label="Vorherige Seite"], span.navBtn.preBtn')
        return !!next || !!prev
      })

      if (hasNavButtons) {
        console.log('🔍 [BACKEND] Detected page navigation buttons')
        return this.detectPagesByClicking(page)
      }

      console.warn('⚠️  [BACKEND] No recognized navigation found')
      return [{ name: 'Page 1', url: page.url() }]

    } catch (error) {
      console.error('❌ [BACKEND] Error detecting pages:', error)
      return [{ name: 'Page 1', url: page.url() }]
    }
  }

  private async detectPagesFromSidebarMenu(page: Page): Promise<Array<{ name: string; url: string }>> {
    console.log('🔍 [BACKEND] Extracting pages from sidebar menu...')

    const pages = await page.evaluate(() => {
      const pageElements: Array<{ name: string; url: string }> = []
      const navMenu = document.querySelector('xap-nav-menu')

      if (!navMenu) {
        console.log('[PAGE.EVAL] No xap-nav-menu found')
        return []
      }

      // Get all xap-nav-link elements
      const navLinks = Array.from(navMenu.querySelectorAll('xap-nav-link')) as HTMLElement[]
      console.log(`[PAGE.EVAL] Found ${navLinks.length} nav links`)

      const seenNames = new Set<string>()

      for (const link of navLinks) {
        const ariaLabel = link.getAttribute('aria-label')
        
        // Looker Studio page IDs are usually in data-page-id or in the URL of the link
        let id = link.getAttribute('data-page-id') || link.getAttribute('id')
        
        if (!id) {
          // If no ID, but it has a class like 'xap-nav-link-...', extract it
          const classes = Array.from(link.classList)
          const idClass = classes.find(c => typeof c === 'string' && c.startsWith('xap-nav-link-'))
          if (idClass) id = idClass.replace('xap-nav-link-', '')
        }

        if (ariaLabel && !seenNames.has(ariaLabel)) {
          seenNames.add(ariaLabel)
          // Construct URL correctly
          const baseUrl = window.location.href.split('/page/')[0]
          const pageUrl = `${baseUrl}/page/${id || 'unknown'}`
          pageElements.push({
            name: ariaLabel,
            url: pageUrl
          })
          console.log(`[PAGE.EVAL] Added: ${ariaLabel} with ID ${id}`)
        }
      }

      return pageElements
    })

    if (pages.length > 0) {
      console.log(`✅ [BACKEND] Found ${pages.length} pages from sidebar:`)
      pages.forEach((p, i) => console.log(`  ✅ [BACKEND] ${i + 1}. ${p.name}`))
      return pages
    }

    console.warn('⚠️  [BACKEND] No pages found in sidebar menu')
    return [{ name: 'Page 1', url: page.url() }]
  }

  private async detectPagesByClicking(page: Page): Promise<Array<{ name: string; url: string }>> {
    console.log('🔍 [BACKEND] Extracting pages by clicking next...')

    try {
      // Wait until navigation controls are available
      await page.waitForFunction(
        () => {
          const next = document.querySelector('span[aria-label="Nächste Seite"], span.navBtn.nextBtn')
          const prev = document.querySelector('span[aria-label="Vorherige Seite"], span.navBtn.preBtn')
          return !!next || !!prev
        },
        { timeout: 25000 }
      )
      console.log('🔍 [BACKEND] Navigation controls available')
    } catch (e) {
      console.warn('⚠️ [BACKEND] Navigation controls did not appear')
    }

    const pageResults: Array<{ name: string; url: string }> = []
    let currentPageNum = 1
    const maxPages = 50
    const seenPageNames = new Set<string>()

    while (currentPageNum <= maxPages) {
      console.log(`🔍 [BACKEND] [Page ${currentPageNum}] Getting current page info...`)

      const pageInfo = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span[aria-label]')).filter(el => {
          const label = el.getAttribute('aria-label') || ''
          return !label.includes('Seite') &&
                 !label.includes('Vorherige') &&
                 !label.includes('Nächste') &&
                 !label.includes('Suche') &&
                 label.length > 3
        })

        const pageName = spans.length > 0 ? spans[0].getAttribute('aria-label') : document.title || 'Page 1'
        return { name: pageName || 'Page 1', url: window.location.href }
      })

      console.log(`🔍 [BACKEND] [${currentPageNum}] Page: "${pageInfo.name}"`)

      if (seenPageNames.has(pageInfo.name) && currentPageNum > 2) {
        console.log(`🔍 [BACKEND] Cycled back to "${pageInfo.name}", stopping`)
        break
      }

      if (!seenPageNames.has(pageInfo.name)) {
        seenPageNames.add(pageInfo.name)
        pageResults.push({ name: pageInfo.name, url: pageInfo.url })
        console.log(`🔍 [BACKEND] ✓ Added: ${pageInfo.name}`)
      }

      let nextButton: any = await page.$('span[aria-label="Nächste Seite"], span.navBtn.nextBtn')
      if (!nextButton) {
        const nextLocator = page.locator('span[role="button"]', { hasText: /Nächste/ }).first()
        if (await nextLocator.count() > 0) {
          nextButton = nextLocator
        }
      }

      if (!nextButton) {
        console.log('🔍 [BACKEND] No "Next Page" button, stopping')
        break
      }

      try {
        await nextButton.click({ timeout: 10000 })
        console.log('🔍 [BACKEND] Clicked next, waiting for page load...')
        await page.waitForTimeout(2500)
      } catch (e) {
        console.error('🔍 [BACKEND] ❌ Failed to click next:', e)
        break
      }

      currentPageNum++
    }

    if (pageResults.length > 0) {
      console.log(`\n✅ [BACKEND] Found ${pageResults.length} pages:`)
      pageResults.forEach((p, i) => console.log(`  ✅ [BACKEND] ${i + 1}. ${p.name}`))
      return pageResults
    }

    console.warn('⚠️  [BACKEND] No pages detected')
    return [{ name: 'Page 1', url: page.url() }]
  }

  private async checkPage(
    page: Page,
    pageName: string,
    pageNumber: number,
    pageUrl?: string
  ): Promise<PageCheckResult> {
    try {
      // Navigate to page
      if (pageUrl) {
        try {
          console.log(`Navigating to page ${pageNumber}: ${pageUrl}`)
          await page.goto(pageUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000 // Increase navigation timeout heavily for isolated tabs
          })
          
          // Smart wait: wait for spinners to vanish, but max 8sec
          await this.waitForLookerStudioStability(page)
        } catch (navError) {
          console.error(`Failed to navigate to page ${pageNumber}:`, navError)
          return {
            pageName,
            pageNumber,
            pageUrl,
            status: 'error',
            errorDescription: `Failed to navigate: ${navError instanceof Error ? navError.message : 'Unknown'}`
          }
        }
      }

      // Listen for console errors
      const consoleErrors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text()
          if (text.includes('google.com') || text.includes('reporting')) {
            consoleErrors.push(`Console: ${text.substring(0, 100)}`)
          }
        }
      })

      // Trigger scrolling to activate lazy-loaded widgets
      try {
        await page.evaluate(async () => {
          window.scrollBy(0, 800)
          await new Promise(r => setTimeout(r, 500))
          window.scrollTo(0, 0)
        })
      } catch { /* ignore */ }

      // Check for loading issues
      const hasLoadingErrors = await this.checkForLoadingErrors(page)

      // Check for error messages
      const errorMessages = await this.checkForErrorMessages(page)

      // Check for data widgets and text
      const { hasWidgets, hasSignificantText } = await this.checkForDataWidgets(page)

      // Determine page status
      // A page is an ERROR if:
      // 1. It has critical loading errors, OR
      // 2. It has specific error messages (even if some widgets loaded), OR
      // 3. It has NO data widgets and NO significant text (likely failed to load content)
      const hasErrors = hasLoadingErrors || errorMessages.length > 0 || (!hasWidgets && !hasSignificantText)

      let errorDescription: string | undefined
      let screenshotUrl: string | undefined

      if (hasErrors || consoleErrors.length > 0) {
        // Take screenshot for debugging
        const screenshot = await page.screenshot({ fullPage: true })
        
        const combinedErrors = [...errorMessages, ...consoleErrors]

        errorDescription = this.buildErrorDescription(
          hasLoadingErrors,
          combinedErrors,
          hasWidgets
        )
      }

      return {
        pageName,
        pageNumber,
        pageUrl: page.url(),
        status: (hasErrors || consoleErrors.length > 0) ? 'error' : 'ok',
        errorDescription,
        screenshotUrl
      }

    } catch (error) {
      return {
        pageName,
        pageNumber,
        pageUrl,
        status: 'error',
        errorDescription: `Failed to check page: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private async waitForLookerStudioStability(page: Page, maxWaitTimeMs: number = 90000) {
    console.log(`Waiting for Looker Studio stability (up to ${maxWaitTimeMs}ms)...`)
    try {
      const waitStart = Date.now()
      
      // Look for common Looker Studio loading indicators
      const loaders = [
        '[aria-label*="Loading" i]',
        '[aria-label*="Laden" i]',
        '.spinner',
        '.loading-mask',
        '.v-spinner',
        'progress',
        'md-progress-bar',
        // Also add logic to wait for data-status="loading" if present
        '[data-loading="true"]'
      ]
      
      let stillLoading = true
      while (stillLoading && (Date.now() - waitStart) < maxWaitTimeMs) {
        let anyLoaderVisible = false
        
        for (const selector of loaders) {
          try {
            // Count elements that are not fully hidden via CSS
            const count = await page.locator(selector).evaluateAll((els) => 
               els.filter(e => {
                  const style = window.getComputedStyle(e);
                  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
               }).length
            )
            
            if (count > 0) {
              anyLoaderVisible = true
              break
            }
          } catch (e) { /* ignore */ }
        }
        
        if (anyLoaderVisible) {
          // Still loading, wait 1s before checking again
          await page.waitForTimeout(1000)
        } else {
          // No loaders visible!
          stillLoading = false
        }
      }
      
      const elapsed = Date.now() - waitStart
      console.log(`Stability wait completed after ${elapsed}ms`)
      
      // Minimum safety wait for rendering the error components after spinner vanishes
      await page.waitForTimeout(3500)
    } catch (e) {
      console.warn('Stability wait threw error:', e)
      await page.waitForTimeout(2000)
    }
  }

  private async navigateToPage(page: Page, tabIndex: number) {
    console.log(`Attempting to navigate to page tab index: ${tabIndex}`)
    
    const maxRetries = 3
    let lastError: Error | null = null

    // Try multiple strategies with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      console.log(`Navigation attempt ${attempt + 1}/${maxRetries}`)

      // Strategy 1: Try clicking on tab elements
      const tabSelectors = [
        `[role="tab"]:nth-of-type(${tabIndex + 1})`,
        `[data-testid*="tab"]:nth-of-type(${tabIndex + 1})`,
        `.tab-item:nth-of-type(${tabIndex + 1})`,
        `.mdc-tab:nth-of-type(${tabIndex + 1})`,
        `[data-page-id]:nth-of-type(${tabIndex + 1})`,
        `button[aria-label*="page" i]:nth-of-type(${tabIndex + 1})`
      ]

      for (const selector of tabSelectors) {
        try {
          const element = await page.$(selector)
          if (element) {
            console.log(`Found element with selector: ${selector}, clicking...`)
            
            // Try to scroll into view first
            try {
              await element.scrollIntoViewIfNeeded()
            } catch (e) {
              console.warn('Could not scroll element:', e)
            }
            
            // Try clicking
            await element.click()
            console.log(`Clicked successfully`)
            
            // Wait for navigation
            await page.waitForTimeout(2000)
            console.log(`Navigation completed`)
            return // Success!
          }
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e))
          console.warn(`Selector failed: ${selector}`, e)
          continue
        }
      }

      // Strategy 2: Use JavaScript to find and click page navigation
      try {
        console.log(`Trying JavaScript-based navigation`)
        
        const clickedViaJS = await page.evaluate((index: number) => {
          // Try multiple ways to find page buttons
          const strategies = [
            { selector: '[data-page-id]', name: 'data-page-id' },
            { selector: '[role="tab"]', name: 'role=tab' },
            { selector: 'button[aria-label*="page" i]', name: 'aria-label' },
            { selector: '[class*="tab"]', name: 'class contains tab' }
          ]

          for (const strategy of strategies) {
            const buttons = Array.from(document.querySelectorAll(strategy.selector))
            console.log(`Strategy "${strategy.name}": found ${buttons.length} elements`)
            
            if (buttons[index]) {
              console.log(`Found target at index ${index}`)
              try {
                // Scroll into view and click synchronously (no Promise!)
                const button = buttons[index] as HTMLElement
                button.scrollIntoView({ behavior: 'smooth', block: 'center' })
                button.click()
                console.log(`Clicked button at index ${index}`)
                return true
              } catch (e) {
                console.error(`Error clicking button: ${e}`)
              }
            }
          }

          return false
        }, tabIndex)

        if (clickedViaJS) {
          await page.waitForTimeout(500) // Wait for click to propagate
          await page.waitForTimeout(2000) // Wait for page transition
          console.log(`JavaScript navigation succeeded`)
          return // Success!
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn('JavaScript navigation failed:', e)
      }

      // Strategy 3: Try keyboard navigation (like arrow right and enter)
      try {
        console.log(`Trying keyboard navigation`)
        
        // Find first tab
        const firstTab = await page.$('[role="tab"]')
        if (firstTab) {
          await firstTab.focus()
          
          // Press right arrow key to navigate to next tabs
          for (let i = 0; i <= tabIndex; i++) {
            if (i > 0) {
              await page.keyboard.press('ArrowRight')
              await page.waitForTimeout(300)
            }
          }
          
          // Press Enter to activate
          await page.keyboard.press('Enter')
          await page.waitForTimeout(2000)
          
          console.log(`Keyboard navigation succeeded`)
          return // Success!
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn('Keyboard navigation failed:', e)
      }

      // Wait before next retry
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000 // Exponential backoff
        console.log(`Waiting ${waitTime}ms before retry...`)
        await page.waitForTimeout(waitTime)
      }
    }

    // All strategies failed
    throw new Error(
      `Could not navigate to page ${tabIndex + 1} after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown'}`
    )
  }

  private async checkForLoadingErrors(page: Page): Promise<boolean> {
    try {
      // Only flag as loading error if there's CRITICAL blocked content
      // Be very specific - most loading indicators in Looker Studio are benign
      const isStuckLoading = await page.evaluate((): boolean => {
        // Check for modal/overlay loading indicators that BLOCK the page
        const blockedLoaders = Array.from(document.querySelectorAll(
          '[role="progressbar"][aria-valuenow="0"],' +
          '.error-state,' +
          '[data-error="true"],' +
          '.fatal-error,' +
          '.critical-error,' +
          '.error-container'
        ))
        
        if (blockedLoaders.length > 0) {
          return true
        }
        
        // Check for full-page overlays that prevent interaction
        const pageOverlay = document.querySelector('[role="dialog"][class*="error"], [role="alertdialog"][class*="error"], .modal-dialog-bg')
        if (pageOverlay) {
          const content = pageOverlay.textContent || ''
          if (content.includes('Failed') || content.includes('Error') || content.includes('Fehler') || content.includes('Problem')) {
            return true
          }
        }
        
        return false
      })

      return isStuckLoading
    } catch {
      return false
    }
  }

  private async checkForErrorMessages(page: Page): Promise<string[]> {
    const allErrors: string[] = []

    try {
      // Give it a few seconds to "settle" initially
      await page.waitForTimeout(2000)

      const patterns = [
        /Data Set Configuration/i,
        /Dataset Configuration/i,
        /cannot connect to your data set/i,
        /Dataset ist nicht konfiguriert/i,
        /Konfigurationsfehler/i,
        /Fehler bei der Datenquelle/i,
        /Details anzeigen/i,
        /See details/i,
        /Details ansehen/i,
        /Ein Fehler ist aufgetreten/i,
        /Systemfehler/i
      ]

      // We poll up to 6 times because external Looker Studio widgets (like Meta Ads via Supermetrics)
      // take exceptionally long to timeout and render their error overlays.
      for (let attempt = 0; attempt < 6; attempt++) {
        const errors: string[] = []

        // 1. Native Playwright Check with getByText
        for (const pattern of patterns) {
          try {
            if (await page.getByText(pattern).count() > 0) {
              errors.push(`Native detection: ${pattern.source}`)
            }
          } catch { /* ignore expected errors */ }
        }

        // 2. Comprehensive recursive search in the browser context
        const deepErrors = await page.evaluate((evalPatterns) => {
          const results: string[] = []
          const regexPatterns = evalPatterns.map(p => new RegExp(p.source, p.flags))

          const checkNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              const content = node.textContent || ''
              for (const pattern of regexPatterns) {
                if (pattern.test(content)) {
                  results.push(`Found text pattern: ${content.trim().substring(0, 50)}`)
                  return true
                }
              }
            }
            
            if (node instanceof Element) {
              if (node.shadowRoot) checkNode(node.shadowRoot)
              
              if (node.classList?.contains('error-message') || 
                  node.classList?.contains('error-container') ||
                  node.getAttribute('data-testid')?.includes('error')) {
                results.push(`Found error container: ${node.className}`)
              }
            }
            
            for (let i = 0; i < node.childNodes.length; i++) {
              checkNode(node.childNodes[i])
            }
            return false
          }

          checkNode(document.body)
          return results
        }, patterns.map(p => ({ source: p.source, flags: p.flags })))

        errors.push(...deepErrors)

        // 3. Fallback: Check all iframes recursively
        const frames = page.frames()
        for (const frame of frames) {
          if (frame === page.mainFrame()) continue
          
          for (const pattern of patterns) {
            try {
              if (await frame.getByText(pattern).count() > 0) {
                errors.push(`Frame native detection: ${pattern.source}`)
              }
            } catch { /* skip */ }
          }
          
          try {
            const frameResults = await frame.evaluate((evalPatterns) => {
              const fResults: string[] = []
              const regexPatterns = evalPatterns.map(p => new RegExp(p.source, p.flags))
              
              const walk = (node: Node) => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                  for (const p of regexPatterns) {
                    if (p.test(node.textContent)) { fResults.push(`Frame text: ${node.textContent.trim().substring(0, 30)}`); return; }
                  }
                }
                if (node instanceof Element && node.shadowRoot) walk(node.shadowRoot)
                for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i])
              }
              walk(document.body)
              return fResults
            }, patterns.map(p => ({ source: p.source, flags: p.flags })))
            errors.push(...frameResults)
          } catch { /* skip */ }
        }

        allErrors.push(...errors)
        
        if (allErrors.length > 0) {
          break // Errors found, stop polling
        }
        
        if (attempt < 5) {
          console.log(`    [Attempt ${attempt + 1}/6] No errors found yet in DOM, waiting 5s before retry...`)
          await page.waitForTimeout(5000)
        }
      }
    } catch (e) {
      console.warn('Error checking for error messages:', e)
    }

    // Deduplicate errors
    return allErrors.filter((e, i, a) => a.indexOf(e) === i)
  }

  private async checkForDataWidgets(page: Page): Promise<{ hasWidgets: boolean, hasSignificantText: boolean }> {
    try {
      // Looker Studio specific widget detection - MORE COMPREHENSIVE
      return await page.evaluate(() => {
        // 1. Check for actual text content
        const bodyText = (document.body.textContent?.trim() || '').length
        const hasSignificantText = bodyText > 300

        // 2. Look for SPECIFIC Looker Studio rendered content
        const googlecharts = !!document.querySelector('[class*="gviz"]')
        
        // 3. Check for SVG charts
        const svgs = Array.from(document.querySelectorAll('svg'))
        const hasActualCharts = svgs.some(svg => {
          const rect = svg.getBoundingClientRect()
          return rect.width > 100 && rect.height > 100
        })
        
        // 4. Look for data table elements
        const tables = document.querySelectorAll('table, [role="grid"]')
        const hasDataTables = tables.length > 0
        
        // 5. Check for metric cards
        const metrics = Array.from(document.querySelectorAll('[class*="metric"], [class*="card"], [role="article"]'))
        const hasMetricCards = metrics.some(el => {
          const text = el.textContent?.trim() || ''
          return /\d{1,}[.,]\d{1,}|\d{2,}\s*/i.test(text)
        })
        
        // 7. Check actual visible elements
        const visibleElementsCount = document.querySelectorAll('*').length
        const hasVisibleContent = visibleElementsCount > 50
        
        const hasWidgets = hasActualCharts || hasDataTables || hasMetricCards || googlecharts
        
        return {
          hasWidgets,
          hasSignificantText: hasSignificantText && hasVisibleContent
        }
      })
    } catch {
      return { hasWidgets: false, hasSignificantText: false }
    }
  }

  private buildErrorDescription(
    hasLoadingErrors: boolean,
    errorMessages: string[],
    hasDataWidgets: boolean
  ): string {
    const errors: string[] = []

    if (hasLoadingErrors) {
      errors.push('Page failed to load completely')
    }

    if (errorMessages.length > 0) {
      errors.push(`Error messages found: ${errorMessages.join(', ')}`)
    }

    if (!hasDataWidgets) {
      errors.push('No data widgets detected on page')
    }

    return errors.join('; ')
  }
}

// Singleton instance for reuse
export const dashboardChecker = new DashboardChecker()
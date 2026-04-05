import { chromium, Browser, Page } from 'playwright'

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

export class DashboardChecker {
  private browser: Browser | null = null

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // <- this one doesn't work in Windows
          '--disable-gpu'
        ]
      })
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  async checkDashboard(dashboardUrl: string): Promise<DashboardCheckResult> {
    await this.initialize()

    if (!this.browser) {
      throw new Error('Browser not initialized')
    }

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'DashboardChecker/1.0'
    })

    const page = await context.newPage()

    try {
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

      // Detect pages and their URLs
      const pages = await this.detectPagesWithUrls(page)

      console.log(`✅ Detected ${pages.length} pages in dashboard`)
      pages.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} - ${p.url}`)
      })

      const pageResults: PageCheckResult[] = []

      // Check each page
      for (let i = 0; i < pages.length; i++) {
        const pageResult = await this.checkPage(page, pages[i].name, i + 1, pages[i].url)
        pageResults.push(pageResult)
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
        const id = link.getAttribute('id')

        if (ariaLabel && !seenNames.has(ariaLabel)) {
          seenNames.add(ariaLabel)
          const pageUrl = `${window.location.origin}${window.location.pathname.split('/page/')[0]}/page/${id || 'unknown'}`
          pageElements.push({
            name: ariaLabel,
            url: pageUrl
          })
          console.log(`[PAGE.EVAL] Added: ${ariaLabel}`)
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
      // Navigate to page if not the first page or if specific URL provided
      if (pageNumber > 1 || pageUrl) {
        try {
          if (pageUrl && pageUrl !== page.url()) {
            console.log(`Navigating to page ${pageNumber}: ${pageUrl}`)
            await page.goto(pageUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 15000
            })
            await page.waitForTimeout(2000)
          } else {
            // Use tabbing strategy for navigation
            await this.navigateToPage(page, pageNumber - 1)
            await page.waitForTimeout(2000)
          }
        } catch (navError) {
          console.error(`Failed to navigate to page ${pageNumber}:`, navError)
          return {
            pageName,
            pageNumber,
            pageUrl,
            status: 'error',
            errorDescription: `Failed to navigate to page: ${navError instanceof Error ? navError.message : 'Unknown error'}`
          }
        }
      }

      // Check for loading issues
      const hasLoadingErrors = await this.checkForLoadingErrors(page)

      // Check for error messages
      const errorMessages = await this.checkForErrorMessages(page)

      // Check for data widgets
      const hasDataWidgets = await this.checkForDataWidgets(page)

      // Determine page status
      // A page is only an ERROR if:
      // 1. It has critical loading errors, OR
      // 2. It has specific error messages AND no data widgets
      // A page with data widgets is OK even if there are minor warnings
      const hasErrors = hasLoadingErrors || (errorMessages.length > 0 && !hasDataWidgets)

      let errorDescription: string | undefined
      let screenshotUrl: string | undefined

      if (hasErrors) {
        // Take screenshot for debugging
        const screenshot = await page.screenshot({ fullPage: true })
        // In a real implementation, upload to Supabase Storage
        // screenshotUrl = await uploadScreenshot(screenshot)

        errorDescription = this.buildErrorDescription(
          hasLoadingErrors,
          errorMessages,
          hasDataWidgets
        )
      }

      return {
        pageName,
        pageNumber,
        pageUrl: page.url(),
        status: hasErrors ? 'error' : 'ok',
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
          '.critical-error'
        ))
        
        if (blockedLoaders.length > 0) {
          return true
        }
        
        // Check for full-page overlays that prevent interaction
        const pageOverlay = document.querySelector('[role="dialog"][class*="error"], [role="alertdialog"][class*="error"]')
        if (pageOverlay) {
          const content = pageOverlay.textContent || ''
          if (content.includes('Failed') || content.includes('Error')) {
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
    const errors: string[] = []

    try {
      // Get all text content and look for specific error indicators
      const errorIndicators = await page.evaluate(() => {
        const indicators: string[] = []

        // 1. Look for Looker Studio specific error dialogs (NOT including system messages)
        const errorDialogs = Array.from(document.querySelectorAll('[role="dialog"] [class*="error"], [role="alertdialog"] [class*="error"]'))
        for (const el of errorDialogs) {
          const text = el.textContent?.trim()
          if (text && !text.includes('Systemfehler') && !text.includes('try again')) {
            indicators.push(`Dialog error: ${text.substring(0, 100)}`)
          }
        }

        // 2. Look for data loading failure indicators (not generic messages)
        const pageContent = document.body.textContent || ''
        
        // Red flag patterns - only these are REAL failures
        const criticalErrors = [
          /failed to load data/i,
          /connection lost/i,
          /cannot connect/i,
          /data source not found/i,
          /unauthorized access/i,
          /data not available/i
        ]

        for (const pattern of criticalErrors) {
          if (pattern.test(pageContent)) {
            indicators.push(pageContent.match(pattern)?.[0] || 'Critical data error')
          }
        }

        // 3. Check for visible error banners (not system messages)
        // EXCLUDE: generic UI messages that aren't actual failures
        const errorBanners = Array.from(document.querySelectorAll('[class*="error-banner"], [class*="alert"]'))
        for (const banner of errorBanners) {
          const text = banner.textContent?.trim()
          // Skip LOOKER STUDIO system/info messages that aren't failures
          if (text && 
              !text.includes('Systemfehler') && 
              !text.includes('momentan nicht') &&
              !text.includes('try signing in') &&
              !text.includes('info') &&
              !text.includes('loading') &&
              !text.includes('Please wait') &&
              !text.includes('Bitte warten') &&
              !text.includes('failed to load') && // Skip generic, already covered above
              text.length > 10 &&
              text.length < 500) {
            indicators.push(text.substring(0, 150))
          }
        }

        return indicators
      })

      errors.push(...errorIndicators)
    } catch (e) {
      console.warn('Error checking for error messages:', e)
    }

    return errors
  }

  private async checkForDataWidgets(page: Page): Promise<boolean> {
    try {
      // Looker Studio specific widget detection - MORE COMPREHENSIVE
      const hasContent = await page.evaluate((): boolean => {
        // 1. Check for actual text content (not just HTML structure)
        const bodyText = (document.body.textContent?.trim() || '').length
        const hasSignificantText = bodyText > 300

        // 2. Look for SPECIFIC Looker Studio rendered content
        const googlecharts = !!document.querySelector('[class*="gviz"]')
        
        // 3. Check for SVG charts (actual graph data rendered)
        const svgs = Array.from(document.querySelectorAll('svg'))
        const hasActualCharts = svgs.some(svg => {
          // Filter out tiny UI SVGs (< 100px likely just icons)
          const rect = svg.getBoundingClientRect()
          return rect.width > 100 && rect.height > 100
        })
        
        // 4. Look for data table elements (grid/table components)
        const tables = document.querySelectorAll('table, [role="grid"]')
        const hasDataTables = tables.length > 0
        
        // 5. Check for metric cards or scorecards (common Looker Studio widgets)
        const metrics = Array.from(document.querySelectorAll('[class*="metric"], [class*="card"], [role="article"]'))
        const hasMetricCards = metrics.some(el => {
          const text = el.textContent?.trim() || ''
          // Must have numeric content
          return /\d{1,}[.,]\d{1,}|\d{2,}\s*/i.test(text)
        })
        
        // 6. Check for navigation menu (indicates dashboard loaded)
        const hasNav = !!document.querySelector('xap-nav-menu')
        
        // 7. Check actual visible elements with data
        const visibleElements = Array.from(document.querySelectorAll('*'))
          .filter(el => {
            const style = window.getComputedStyle(el)
            const rect = el.getBoundingClientRect()
            return style.display !== 'none' && rect.height > 0
          })
        const hasVisibleContent = visibleElements.length > 50
        
        // Page has loaded if: significant text + (charts OR tables OR metrics) + visible content
        const result = hasSignificantText && 
               (hasActualCharts || hasDataTables || hasMetricCards || googlecharts) && 
               hasVisibleContent
        
        return !!result
      })

      return hasContent
    } catch {
      return false
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
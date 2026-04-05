#!/usr/bin/env node

const { chromium } = require('playwright');

async function testPageDetectionFinal() {
  console.log('🧪 Direct Page Detection Test\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log all console messages
  page.on('console', msg => {
    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  try {
    const dashboardUrl = 'https://lookerstudio.google.com/reporting/08309100-4dd7-4923-a091-a94a39beb2b6';
    
    console.log(`📍 Opening dashboard: ${dashboardUrl}\n`);
    await page.goto(dashboardUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log('🔍 Extracting pages using our detection logic...\n');

    // Run our page detection logic
    const pages = await page.evaluate(async () => {
      const pageResults = [];
      let currentPageNum = 1;
      const maxPages = 50;
      const seenPageNames = new Set();

      while (currentPageNum <= maxPages) {
        // Get current page name
        const spans = Array.from(document.querySelectorAll('span[aria-label]')).filter(el => {
          const label = el.getAttribute('aria-label') || '';
          return !label.includes('Seite') && 
                 !label.includes('Vorherige') && 
                 !label.includes('Nächste') &&
                 !label.includes('Suche') &&
                 label.length > 3;
        });

        const pageName = spans.length > 0 ? spans[0].getAttribute('aria-label') : `Page ${1}`;
        const url = window.location.href;

        console.log(`[${currentPageNum}] ${pageName}`);
        
        if (seenPageNames.has(pageName) && currentPageNum > 2) {
          console.log(`Cycled back to "${pageName}"`);
          break;
        }

        if (!seenPageNames.has(pageName)) {
          seenPageNames.add(pageName);
          pageResults.push({
            name: pageName,
            url: url,
            pageNumber: currentPageNum
          });
          console.log(`✓ Added: ${pageName}`);
        }

        // Look for next button
        const nextButton = document.querySelector('span[aria-label="Nächste Seite"]');
        if (!nextButton) {
          console.log('No next button found');
          break;
        }

        try {
          nextButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
          console.log('Could not click next button');
          break;
        }

        currentPageNum++;
      }

      console.log(`\n✅ Total pages found: ${pageResults.length}`);
      return pageResults;
    });

    console.log('\n✅ SUCCESS! Detection Complete\n');
    console.log(`📊 Found ${pages.length} pages:\n`);
    pages.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name}`);
      console.log(`     URL: ${p.url.substring(p.url.lastIndexOf('/page/'))}`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testPageDetectionFinal().catch(console.error);

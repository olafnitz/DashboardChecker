#!/usr/bin/env node

const { chromium } = require('playwright');

async function testPageNavigation() {
  console.log('🧪 Testing "Next Page" navigation...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const dashboardUrl = 'https://lookerstudio.google.com/reporting/08309100-4dd7-4923-a091-a94a39beb2b6';
    
    console.log(`📍 Opening: ${dashboardUrl}\n`);
    await page.goto(dashboardUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const pageLog = [];

    // Try up to 15 pages
    for (let i = 0; i < 15; i++) {
      console.log(`\n📄 Checking page ${i + 1}...`);

      // Get current page name
      const pageName = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span[aria-label]')).filter(el => {
          const label = el.getAttribute('aria-label') || '';
          return !label.includes('Seite') && 
                 !label.includes('Vorherige') && 
                 !label.includes('Nächste') &&
                 !label.includes('Suche') &&
                 label.length > 3;
        });

        if (spans.length > 0) {
          return spans[0].getAttribute('aria-label');
        }
        return `Page ${1}`;
      });

      const currentUrl = page.url();
      console.log(`  Name: ${pageName}`);
      console.log(`  URL: ${currentUrl}`);

      pageLog.push({ num: i + 1, name: pageName, url: currentUrl });

      // Check if this is a duplicate page (cycled back)
      const isDuplicate = pageLog.slice(0, -1).some(p => p.name === pageName);
      if (isDuplicate && i > 1) {
        console.log(`\n🔄 Duplicate page found! Cycled back to "${pageName}"`);
        console.log(`✅ Found ${i} unique pages\n`);
        break;
      }

      // Click "Nächste Seite" (Next Page)
      const nextBtn = await page.$('span[aria-label="Nächste Seite"]');
      if (!nextBtn) {
        console.log('⏹️  No "Next Page" button found');
        break;
      }

      console.log('  → Clicking "Next Page"...');
      await nextBtn.click();
      await page.waitForTimeout(2000);
    }

    console.log('\n📋 All pages found:');
    pageLog.forEach(p => {
      console.log(`  ${p.num}. ${p.name}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await new Promise(() => {});
  }
}

testPageNavigation().catch(console.error);

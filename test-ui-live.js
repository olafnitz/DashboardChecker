#!/usr/bin/env node

const { chromium } = require('playwright');

async function testPageDetectionLive() {
  console.log('🧪 Testing Page Detection via UI\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    // Use authentication cookie if available - for now just open the page
  });
  
  const page = await context.newPage();

  // Capture all console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`[BROWSER CONSOLE] ${text}`);
  });

  try {
    // 1. Navigate to localhost to get dashboard list
    console.log('1️⃣  Opening application at http://localhost:3000/dashboards\n');
    await page.goto('http://localhost:3000/dashboards', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);

    // 2. Look for "Bau 2022" link and click it
    console.log('2️⃣ Looking for "Bau 2022" dashboard...');
    
    const bauElement = await page.$('text=Bau 2022');
    if (!bauElement) {
      console.log('  ❌ "Bau 2022" not found on page');
      const bodyText = await page.textContent('body');
      console.log('  Available text:', bodyText.substring(0, 200));
      await page.waitForTimeout(5000);
      return;
    }

    console.log('  ✓ Found "Bau 2022", navigating...');
    await bauElement.click();
    await page.waitForTimeout(3000);

    // 3. Click "Check Now" button
    console.log('3️⃣  Clicking "Check Now" button...\n');
    
    const checkButton = await page.$('button:has-text("Check Now")');
    if (!checkButton) {
      console.log('  ❌ "Check Now" button not found');
      const bodyText = await page.textContent('body');
      console.log('  Page content:', bodyText.substring(0, 200));
      return;
    }

    console.log('  ✓ Found button, clicking...');
    await checkButton.click();

    // 4. Wait for check to complete (monitor console logs)
    console.log('4️⃣  Check in progress, monitoring console logs...\n');
    
    let pageCount = null;
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes

    while (Date.now() - startTime < timeout) {
      // Check if we found page count log
      const pageDetectionLog = consoleLogs.find(log => log.includes('Found') && log.includes('pages'));
      
      if (pageDetectionLog) {
        console.log(`\n✅ Page detection complete!`);
        console.log(`   Message: ${pageDetectionLog}\n`);
        pageCount = pageDetectionLog.match(/\d+/)?.[0];
        break;
      }

      await page.waitForTimeout(2000);
      process.stdout.write('.');
    }

    if (!pageCount) {
      console.log('\n⏱️  Check still in progress or timeout...\n');
    }

    // 5. Wait a bit more for final results to render
    await page.waitForTimeout(5000);

    // 6. Check for result display
    const results = await page.textContent('body');
    console.log('📊 Page Results:');
    
    // Look for page count info
    const pageCountMatch = results.match(/(\d+)\/(\d+) pages OK/);
    if (pageCountMatch) {
      console.log(`   ${pageCountMatch[1]}/${pageCountMatch[2]} pages OK`);
    }

    // Look for page entries
    const pageMatches = results.match(/Page \d+/g);
    if (pageMatches) {
      console.log(`   Total pages found: ${pageMatches.length}`);
      pageMatches.slice(0, 5).forEach(p => console.log(`     - ${p}`));
    }

    console.log('\n🧪 All console logs during test:');
    consoleLogs.forEach((log, idx) => {
      console.log(`  [${idx}] ${log}`);
    });

    console.log('\n✅ Test completed. Browser will stay open for inspection.');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPageDetectionLive().catch(console.error);

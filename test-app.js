#!/usr/bin/env node

const { chromium } = require('playwright');

async function testDashboardChecker() {
  console.log('🧪 Testing Dashboard Checker Application\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console message logging
  page.on('console', msg => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  try {
    // 1. Open the app
    console.log('1️⃣  Opening application...\n');
    await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 15000 });
    
    // 2. Wait for login (if needed) or dashboards to load
    await page.waitForTimeout(2000);
    
    // Try to find navigation to dashboards
    const dashboardsLink = await page.$('a:has-text("dashboards"), button:has-text("Dashboard")');
    if (dashboardsLink) {
      console.log('   Found dashboards link, clicking...');
      await dashboardsLink.click();
      await page.waitForTimeout(2000);
    }
    
    // 3. Look for Bau 2022 dashboard
    console.log('2️⃣  Looking for "Bau 2022" dashboard...\n');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Click on Bau 2022 dashboard
    const bauLink = await page.$('text=Bau 2022, a >> nth=0');
    if (bauLink) {
      console.log('   Found "Bau 2022" dashboard, opening...');
      await bauLink.click();
      await page.waitForTimeout(3000);
      
      // 4. Click "Check Now" button
      console.log('3️⃣  Clicking "Check Now" button...\n');
      
      const checkBtn = await page.$('button:has-text("Check Now")');
      if (checkBtn) {
        console.log('   ✓ Found "Check Now" button');
        await checkBtn.click();
        
        // 5. Wait for check to complete and monitor logs
        console.log('4️⃣  Check in progress...\n');
        
        // Wait for results (max 120 seconds)
        for (let i = 0; i < 60; i++) {
          const results = await page.$('[class*="Summary"], text=/pages OK/');
          
          if (results) {
            console.log('\n✅ Check completed! Results visible.\n');
            
            // Read the results
            const resultText = await page.textContent('body');
            const pageCountMatch = resultText.match(/(\d+)\/(\d+) pages OK|(\d+) pages/);
            
            if (pageCountMatch) {
              console.log('📊 Result Summary:');
              console.log(resultText.substring(0, 500));
            }
            
            return;
          }
          
          await page.waitForTimeout(2000);
          console.log(`   Waiting... (${i * 2}s)`);
        }
        
        console.log('⏱️  Timeout waiting for results');
      } else {
        console.log('❌ Could not find "Check Now" button');
      }
    } else {
      console.log('❌ Could not find "Bau 2022" dashboard');
      // List available dashboards
      const dashboardNames = await page.textContent('body');
      console.log('Available content:', dashboardNames.substring(0, 200));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n✅ Test complete');
    await browser.close();
  }
}

testDashboardChecker().catch(console.error);

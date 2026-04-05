#!/usr/bin/env node

const { chromium } = require('playwright');

async function triggerCheckAndMonitor() {
  console.log('📱 Testing check endpoint with new logging...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture response
  let responseBody = null;
  page.on('response', async response => {
    if (response.url().includes('/api/checks')) {
      try {
        responseBody = await response.json();
        console.log(`📨 API Response: ${response.status()}`);
        console.log(JSON.stringify(responseBody, null, 2));
      } catch (e) {
        console.log(`Could not parse response: ${e.message}`);
      }
    }
  });

  try {
    // Simulate calling the API directly
    const dashboardId = '08309100-4dd7-4923-a091-a94a39beb2b6';
    
    console.log(`📍 Dashboard ID: ${dashboardId}`);
    console.log(`🔄 Calling /api/checks endpoint...\n`);

    // Call the check endpoint
    const response = await fetch('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dashboardId: dashboardId
      })
    });

    console.log(`✅ Response Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Check Completed:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log(`\n❌ Error: ${error}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

triggerCheckAndMonitor().catch(console.error);

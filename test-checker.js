#!/usr/bin/env node

const { DashboardChecker } = require('./lib/checks/dashboardChecker.ts');

async function testPageDetection() {
  console.log('🧪 Testing Page Detection\n');

  const checker = new DashboardChecker();

  try {
    // Initialize browser
    console.log('1️⃣  Initializing Playwright browser...');
    await checker.initialize();
    console.log('   ✓ Browser initialized\n');

    // Test URL - the Bau 2022 dashboard
    const testUrl = 'https://lookerstudio.google.com/reporting/08309100-4dd7-4923-a091-a94a39beb2b6';
    
    console.log('2️⃣  Checking dashboard...');
    console.log(`   URL: ${testUrl}\n`);

    const result = await checker.checkDashboard(testUrl);

    console.log('\n✅ Check Complete!\n');
    console.log('📊 Results:');
    console.log(`   Overall Status: ${result.overallStatus}`);
    console.log(`   Total Pages: ${result.pageResults.length}\n`);

    console.log('🔍 Pages:');
    result.pageResults.forEach((page, idx) => {
      console.log(`   ${idx + 1}. ${page.pageName}`);
      console.log(`      Status: ${page.status}`);
      if (page.pageUrl) {
        console.log(`      URL: ${page.pageUrl}`);
      }
      if (page.errorDescription) {
        console.log(`      Error: ${page.errorDescription}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n📍 Closing browser...');
    await checker.close();
    console.log('✓ Done');
    process.exit(0);
  }
}

testPageDetection().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

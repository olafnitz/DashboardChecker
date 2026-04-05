const { chromium } = require('playwright-core');

(async () => {
  try {
    console.log("Launching chromium...");
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-site-isolation-trials',
        '--disable-features=IsolateOrigins,site-per-process,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
      ]
    });
    console.log("Browser launched successfully.");
    const page = await browser.newPage();
    console.log("Page created.");
    await browser.close();
  } catch (e) {
    console.error("Crash:", e);
  }
})();

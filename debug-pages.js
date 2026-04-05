#!/usr/bin/env node

const { chromium } = require('playwright');

async function debugPages() {
  console.log('🔍 Deep debugging - finding actual page structure...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const dashboardUrl = 'https://lookerstudio.google.com/reporting/08309100-4dd7-4923-a091-a94a39beb2b6';
    
    console.log(`📍 Opening: ${dashboardUrl}\n`);
    await page.goto(dashboardUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const result = await page.evaluate(() => {
      const analysis = {
        // Look for ANY elements that might be pages
        buttonElements: 0,
        aElements: 0,
        divWithData: 0,
        allAriaCurrentElements: [],
        allAriaLabelElements: [],
        elementsThatMightBePagesAlt: [],
        bodyContent: '',
        possibleNavContainers: []
      };

      // Count button and link elements
      analysis.buttonElements = document.querySelectorAll('button[aria-label]').length;
      analysis.aElements = document.querySelectorAll('a[aria-label]').length;

      // Find elements with data-* attributes
      analysis.divWithData = document.querySelectorAll('[data-page], [data-page-id], [data-tab]').length;

      // Find elements with aria-current (might indicate current page)
      const ariaCurrent = document.querySelectorAll('[aria-current="page"], [aria-current="true"]');
      ariaCurrent.forEach(el => {
        analysis.allAriaCurrentElements.push({
          tag: el.tagName,
          text: el.innerText?.substring(0, 50),
          ariaLabel: el.getAttribute('aria-label'),
          dataAttrs: Array.from(el.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .map(attr => `${attr.name}=${attr.value}`)
        });
      });

      // Find ALL elements with aria-label in sidebar/nav area
      const sidebar = document.querySelector('[role="navigation"]') ||
                     document.querySelector('nav') ||
                     document.querySelector('[class*="nav"]') ||
                     document.querySelector('[class*="sidebar"]');
      
      if (sidebar) {
        analysis.possibleNavContainers.push({
          type: 'sidebar',
          tag: sidebar.tagName,
          class: sidebar.className
        });
        
        const items = sidebar.querySelectorAll('[aria-label]');
        items.forEach(item => {
          if (!analysis.allAriaLabelElements.some(e => e.label === item.getAttribute('aria-label'))) {
            analysis.allAriaLabelElements.push({
              tag: item.tagName,
              label: item.getAttribute('aria-label'),
              role: item.getAttribute('role'),
              id: item.getAttribute('id'),
              dataAttrs: Array.from(item.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .map(attr => `${attr.name}=${attr.value}`)
            });
          }
        });
      }

      // If no sidebar, search globally
      if (analysis.allAriaLabelElements.length === 0) {
        const globalLabels = Array.from(document.querySelectorAll('[aria-label]'))
          .slice(0, 50);
        
        globalLabels.forEach(item => {
          const label = item.getAttribute('aria-label');
          if (label && label.length > 0 && !label.includes('Suche')) {
            analysis.allAriaLabelElements.push({
              tag: item.tagName,
              label: label,
              role: item.getAttribute('role'),
              id: item.getAttribute('id'),
              class: item.className?.substring(0, 50)
            });
          }
        });
      }

      return analysis;
    });

    console.log('📊 Structure Analysis:\n');
    console.log(`Buttons with aria-label: ${result.buttonElements}`);
    console.log(`Links with aria-label: ${result.aElements}`);
    console.log(`Elements with data-page*: ${result.divWithData}`);
    
    console.log('\n🔗 Elements with aria-current (current page):');
    result.allAriaCurrentElements.forEach((el, i) => {
      console.log(`  [${i}] <${el.tag}> aria-label="${el.ariaLabel}"`);
      console.log(`      text: "${el.text}"`);
      el.dataAttrs.forEach(attr => console.log(`      ${attr}`));
    });

    console.log('\n📖 All aria-label elements (first 50):');
    result.allAriaLabelElements.slice(0, 20).forEach((el, i) => {
      console.log(`  [${i}] <${el.tag}> aria-label="${el.label}" role="${el.role}"`);
      if (el.id) console.log(`      id: ${el.id}`);
      if (el.dataAttrs.length > 0) el.dataAttrs.forEach(attr => console.log(`      ${attr}`));
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    console.log('\n⏸️  Browser open for inspection...');
    await new Promise(() => {});
  }
}

debugPages().catch(console.error);

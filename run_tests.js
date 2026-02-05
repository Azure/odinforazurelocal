const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function executeTests() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const pageInstance = await browser.newPage();

    // Collect all console messages
    pageInstance.on('console', msg => {
      console.log('PAGE LOG:', msg.text());
    });

    // Handle page errors
    pageInstance.on('error', err => {
      console.error('Page error:', err);
    });

    const testFilePath = path.join(process.cwd(), 'tests', 'index.html');
    const fileUrl = `file://${testFilePath}`;

    console.log(`Loading test suite from: ${testFilePath}\n`);

    await pageInstance.goto(fileUrl, { waitUntil: 'networkidle0' });

    // Wait for the test harness to populate the result counters
    const testCompletion = await pageInstance.waitForFunction(
      () => {
        const pCount = document.querySelector('#pass-count');
        const fCount = document.querySelector('#fail-count');
        if (!pCount || !fCount) return false;
        const p = parseInt(pCount.textContent) || 0;
        const f = parseInt(fCount.textContent) || 0;
        return p > 0 || f > 0;
      },
      { timeout: 30000 }
    );

    // Extract final test counts
    const testData = await pageInstance.evaluate(() => {
      return {
        pass: parseInt(document.querySelector('#pass-count')?.textContent || '0'),
        fail: parseInt(document.querySelector('#fail-count')?.textContent || '0'),
        total: parseInt(document.querySelector('#total-count')?.textContent || '0')
      };
    });

    await browser.close();

    // Report results
    console.log('\n' + '='.repeat(50));
    console.log(`TEST RESULTS`);
    console.log('='.repeat(50));
    console.log(`Total Tests: ${testData.total}`);
    console.log(`Passed: ${testData.pass}`);
    console.log(`Failed: ${testData.fail}`);
    console.log('='.repeat(50) + '\n');

    // Determine exit status
    const success = testData.fail === 0 && testData.pass > 0;
    if (success) {
      console.log(`✅ All tests passed!`);
      process.exit(0);
    } else {
      console.log(`❌ Some tests failed`);
      process.exit(1);
    }

  } catch (err) {
    console.error('Test execution error:', err.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

executeTests();

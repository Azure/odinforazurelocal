/**
 * Run ODIN unit tests using Puppeteer and generate NUnit XML report
 * Usage: node scripts/run-tests.js [--nunit | --junit]
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const outputFormat = process.argv.includes('--junit') ? 'junit' : 'nunit';

function generateNUnitXML(results, passed, failed, total) {
    const timestamp = new Date().toISOString();
    const result = failed > 0 ? 'Failed' : 'Passed';
    
    // Group results by suite
    const suites = {};
    results.forEach(r => {
        const suiteName = r.suite || 'Default';
        if (!suites[suiteName]) {
            suites[suiteName] = [];
        }
        suites[suiteName].push(r);
    });
    
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += `<test-run id="1" testcasecount="${total}" result="${result}" total="${total}" passed="${passed}" failed="${failed}" inconclusive="0" skipped="0" start-time="${timestamp}" end-time="${timestamp}" duration="0">\n`;
    xml += `  <test-suite type="Assembly" id="0-1" name="ODIN.Tests" fullname="ODIN.Tests" testcasecount="${total}" result="${result}" total="${total}" passed="${passed}" failed="${failed}" inconclusive="0" skipped="0">\n`;
    
    let suiteId = 1;
    Object.entries(suites).forEach(([suiteName, tests]) => {
        const suiteFailures = tests.filter(t => !t.passed).length;
        const suiteResult = suiteFailures > 0 ? 'Failed' : 'Passed';
        const safeSuiteName = suiteName.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
        
        xml += `    <test-suite type="TestFixture" id="0-${suiteId}" name="${safeSuiteName}" fullname="ODIN.Tests.${safeSuiteName}" testcasecount="${tests.length}" result="${suiteResult}" total="${tests.length}" passed="${tests.length - suiteFailures}" failed="${suiteFailures}" inconclusive="0" skipped="0">\n`;
        
        let testId = 1;
        tests.forEach(test => {
            const safeTestName = test.name.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
            const testResult = test.passed ? 'Passed' : 'Failed';
            
            xml += `      <test-case id="0-${suiteId}-${testId}" name="${safeTestName}" fullname="ODIN.Tests.${safeSuiteName}.${safeTestName}" result="${testResult}">\n`;
            
            if (!test.passed) {
                const safeExpected = String(test.expected).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
                const safeActual = String(test.actual).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
                xml += `        <failure>\n`;
                xml += `          <message><![CDATA[Expected: ${safeExpected}, Got: ${safeActual}]]></message>\n`;
                xml += `          <stack-trace><![CDATA[Expected: ${safeExpected}\nActual: ${safeActual}]]></stack-trace>\n`;
                xml += `        </failure>\n`;
            }
            
            xml += `      </test-case>\n`;
            testId++;
        });
        
        xml += `    </test-suite>\n`;
        suiteId++;
    });
    
    xml += `  </test-suite>\n`;
    xml += `</test-run>\n`;
    return xml;
}

function generateJUnitXML(results, passed, failed, total) {
    const timestamp = new Date().toISOString();
    
    // Group results by suite
    const suites = {};
    results.forEach(r => {
        const suiteName = r.suite || 'Default';
        if (!suites[suiteName]) {
            suites[suiteName] = [];
        }
        suites[suiteName].push(r);
    });
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites name="ODIN Unit Tests" tests="${total}" failures="${failed}" time="0" timestamp="${timestamp}">\n`;
    
    Object.entries(suites).forEach(([suiteName, tests]) => {
        const suiteFailures = tests.filter(t => !t.passed).length;
        const safeSuiteName = suiteName.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
        xml += `  <testsuite name="${safeSuiteName}" tests="${tests.length}" failures="${suiteFailures}" time="0">\n`;
        
        tests.forEach(test => {
            const safeTestName = test.name.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
            xml += `    <testcase name="${safeTestName}" classname="${safeSuiteName}" time="0">\n`;
            
            if (!test.passed) {
                const safeExpected = String(test.expected).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
                const safeActual = String(test.actual).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
                xml += `      <failure message="Expected: ${safeExpected}, Got: ${safeActual}" type="AssertionError">\n`;
                xml += `Expected: ${safeExpected}\nActual: ${safeActual}\n`;
                xml += `      </failure>\n`;
            }
            
            xml += `    </testcase>\n`;
        });
        
        xml += `  </testsuite>\n`;
    });
    
    xml += '</testsuites>\n';
    return xml;
}

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Capture console output
        page.on('console', msg => console.log('Browser:', msg.text()));
        page.on('pageerror', err => console.error('Page error:', err.message));
        
        // Load the test file
        const testPath = path.resolve(process.cwd(), 'tests', 'index.html');
        console.log('Loading tests from:', testPath);
        await page.goto(`file://${testPath}`, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Wait for tests to complete
        console.log('Waiting for tests to complete...');
        await page.waitForFunction(() => {
            const passEl = document.getElementById('pass-count');
            const failEl = document.getElementById('fail-count');
            return passEl && failEl && (parseInt(passEl.textContent) > 0 || parseInt(failEl.textContent) > 0);
        }, { timeout: 60000 });
        
        // Get test results
        const results = await page.evaluate(() => {
            return {
                passed: parseInt(document.getElementById('pass-count').textContent),
                failed: parseInt(document.getElementById('fail-count').textContent),
                total: parseInt(document.getElementById('total-count').textContent),
                details: window.testResults || []
            };
        });
        
        console.log(`\n========================================`);
        console.log(`Test Results: ${results.passed}/${results.total} passed, ${results.failed} failed`);
        console.log(`========================================\n`);
        
        // Ensure test-results directory exists
        const resultsDir = path.resolve(process.cwd(), 'test-results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        // Generate and write XML reports
        if (outputFormat === 'nunit' || !process.argv.includes('--junit')) {
            const nunitXml = generateNUnitXML(results.details, results.passed, results.failed, results.total);
            const nunitPath = path.join(resultsDir, 'nunit.xml');
            fs.writeFileSync(nunitPath, nunitXml);
            console.log(`NUnit XML report written to: ${nunitPath}`);
        }
        
        if (outputFormat === 'junit' || !process.argv.includes('--nunit')) {
            const junitXml = generateJUnitXML(results.details, results.passed, results.failed, results.total);
            const junitPath = path.join(resultsDir, 'junit.xml');
            fs.writeFileSync(junitPath, junitXml);
            console.log(`JUnit XML report written to: ${junitPath}`);
        }
        
        // Print failed tests
        if (results.failed > 0) {
            console.log('\nFailed tests:');
            results.details.filter(t => !t.passed).forEach(t => {
                console.log(`  ❌ ${t.name}`);
                console.log(`     Expected: ${t.expected}`);
                console.log(`     Actual: ${t.actual}`);
            });
        }
        
        await browser.close();
        
        // Exit with error code if tests failed
        if (results.failed > 0) {
            console.error(`\n❌ ${results.failed} test(s) failed`);
            process.exit(1);
        }
        
        console.log(`\n✅ All ${results.passed} tests passed!`);
        process.exit(0);
    } catch (err) {
        console.error('Error running tests:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
})();

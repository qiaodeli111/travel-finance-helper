const { chromium } = require('playwright');
const fs = require('fs');

const TIMESTAMP = Date.now();
const SESSION_NAME = `qa-travel-finance-test-${TIMESTAMP}`;
const SCREENSHOT_DIR = '/home/jetio/jetdev/github/travel-finance-helper/qa-screenshots';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const testResults = {
  session: SESSION_NAME,
  url: 'http://localhost:3000',
  testCases: [],
  startTime: new Date().toISOString()
};

function addTestCase(name, command, expected, actual, status) {
  testResults.testCases.push({
    name,
    command,
    expected,
    actual,
    status,
    timestamp: new Date().toISOString()
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('## QA Test Report: Travel Finance Helper');
  console.log('### Environment');
  console.log(`- Session: ${SESSION_NAME}`);
  console.log(`- Service: Travel Finance Helper (React + Firebase)`);
  console.log(`- URL: http://localhost:3000`);
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => console.log(`  [BROWSER ${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.log(`  [PAGE ERROR]: ${err.message}`));

  try {
    // ============================================
    // TC1: Initial Page Load
    // ============================================
    console.log('### Test Cases');
    console.log('#### TC1: Initial Page Load');
    console.log('- **Command**: `Navigate to http://localhost:3000`');

    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);

      const screenshot1 = `${SCREENSHOT_DIR}/01-initial-state.png`;
      await page.screenshot({ path: screenshot1, fullPage: true });

      const pageContent = await page.content();
      const hasContent = pageContent.length > 1000;
      const bodyText = await page.locator('body').innerText();
      const hasVisibleText = bodyText.trim().length > 0;

      // Check for React root
      const rootElement = await page.$('#root');
      const rootContent = rootElement ? await rootElement.innerHTML() : '';
      const rootHasContent = rootContent.trim().length > 0;

      console.log(`- **Expected**: Page loads with visible content`);
      console.log(`- **Actual**: Page loaded. Root has content: ${rootHasContent}, Body text length: ${bodyText.length}`);
      console.log(`- **Screenshot**: ${screenshot1}`);

      if (hasVisibleText && rootHasContent) {
        console.log('- **Status**: PASS');
        addTestCase('Initial Page Load', 'Navigate to http://localhost:3000', 'Page loads with visible content', `Root has content: ${rootHasContent}, Body text length: ${bodyText.length}`, 'PASS');
      } else {
        console.log('- **Status**: FAIL');
        addTestCase('Initial Page Load', 'Navigate to http://localhost:3000', 'Page loads with visible content', `Root has content: ${rootHasContent}, Body text length: ${bodyText.length}`, 'FAIL');
      }
      console.log('');
    } catch (error) {
      console.log(`- **Status**: FAIL - ${error.message}`);
      addTestCase('Initial Page Load', 'Navigate to http://localhost:3000', 'Page loads with visible content', `Error: ${error.message}`, 'FAIL');
      console.log('');
    }

    // ============================================
    // TC2: Check for Login/Auth UI Elements
    // ============================================
    console.log('#### TC2: Check for Login/Auth UI Elements');
    console.log('- **Command**: `Look for login button or auth UI`');

    try {
      // Common selectors for login elements
      const loginSelectors = [
        'button:has-text("登录")',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'button:has-text("登录/注册")',
        '[data-testid="login-button"]',
        '.login-button',
        'button[class*="login"]',
        'a:has-text("登录")',
        'a:has-text("Login")'
      ];

      let loginElement = null;
      let foundSelector = '';

      for (const selector of loginSelectors) {
        try {
          loginElement = await page.$(selector);
          if (loginElement) {
            foundSelector = selector;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      const screenshot2 = `${SCREENSHOT_DIR}/02-auth-ui-check.png`;
      await page.screenshot({ path: screenshot2, fullPage: true });

      if (loginElement) {
        const buttonText = await loginElement.innerText();
        console.log(`- **Expected**: Find login/auth UI element`);
        console.log(`- **Actual**: Found login element with selector "${foundSelector}", text: "${buttonText}"`);
        console.log('- **Status**: PASS');
        addTestCase('Login/Auth UI Elements', 'Look for login button or auth UI', 'Find login/auth UI element', `Found: "${buttonText}" via ${foundSelector}`, 'PASS');
      } else {
        // Check if already logged in or has different UI
        const pageText = await page.locator('body').innerText();
        const hasAuthRelatedText = pageText.includes('登录') || pageText.includes('Login') || pageText.includes('Sign') || pageText.includes('用户');

        console.log(`- **Expected**: Find login/auth UI element`);
        console.log(`- **Actual**: No login button found. Auth-related text on page: ${hasAuthRelatedText}`);
        console.log('- **Status**: INFO - May already be logged in or different auth flow');
        addTestCase('Login/Auth UI Elements', 'Look for login button or auth UI', 'Find login/auth UI element', 'No login button found - may be logged in or different UI', 'INFO');
      }
      console.log('');
    } catch (error) {
      console.log(`- **Status**: FAIL - ${error.message}`);
      addTestCase('Login/Auth UI Elements', 'Look for login button or auth UI', 'Find login/auth UI element', `Error: ${error.message}`, 'FAIL');
      console.log('');
    }

    // ============================================
    // TC3: Attempt to Trigger Login Dialog
    // ============================================
    console.log('#### TC3: Attempt to Trigger Login Dialog');
    console.log('- **Command**: `Click login button if present`');

    try {
      // Try to find and click login button
      const possibleButtons = [
        'button:has-text("登录")',
        'button:has-text("登录/注册")',
        'button:has-text("Login")'
      ];

      let clicked = false;
      for (const selector of possibleButtons) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            clicked = true;
            await sleep(1500);
            break;
          }
        } catch (e) {
          // Continue
        }
      }

      const screenshot3 = `${SCREENSHOT_DIR}/03-after-login-click.png`;
      await page.screenshot({ path: screenshot3, fullPage: true });

      // Check if dialog/modal appeared
      const dialogSelectors = ['[role="dialog"]', '.modal', '.dialog', '[class*="modal"]', '[class*="dialog"]'];
      let dialogFound = false;

      for (const selector of dialogSelectors) {
        const dialog = await page.$(selector);
        if (dialog) {
          dialogFound = true;
          break;
        }
      }

      if (clicked && dialogFound) {
        console.log(`- **Expected**: Login dialog appears after clicking login`);
        console.log(`- **Actual**: Login dialog appeared`);
        console.log('- **Status**: PASS');
        addTestCase('Trigger Login Dialog', 'Click login button', 'Login dialog appears', 'Dialog appeared after click', 'PASS');
      } else if (clicked && !dialogFound) {
        console.log(`- **Expected**: Login dialog appears after clicking login`);
        console.log(`- **Actual**: Button clicked but no dialog detected`);
        console.log('- **Status**: INFO - May use different UI pattern');
        addTestCase('Trigger Login Dialog', 'Click login button', 'Login dialog appears', 'Button clicked, no dialog detected', 'INFO');
      } else {
        console.log(`- **Expected**: Login dialog appears after clicking login`);
        console.log(`- **Actual**: No login button found to click`);
        console.log('- **Status**: INFO - No login button present');
        addTestCase('Trigger Login Dialog', 'Click login button', 'Login dialog appears', 'No login button found', 'INFO');
      }
      console.log('');
    } catch (error) {
      console.log(`- **Status**: FAIL - ${error.message}`);
      addTestCase('Trigger Login Dialog', 'Click login button', 'Login dialog appears', `Error: ${error.message}`, 'FAIL');
      console.log('');
    }

    // ============================================
    // TC4: Check Page Content After Any Auth State
    // ============================================
    console.log('#### TC4: Check Page Content Structure');
    console.log('- **Command**: `Analyze page structure and content`');

    try {
      const screenshot4 = `${SCREENSHOT_DIR}/04-page-structure.png`;
      await page.screenshot({ path: screenshot4, fullPage: true });

      // Check for main content areas
      const mainContent = await page.$('main');
      const headerContent = await page.$('header');
      const navContent = await page.$('nav');

      // Get all visible text
      const visibleText = await page.locator('body').innerText();
      const textLines = visibleText.split('\n').filter(line => line.trim().length > 0);

      // Check for specific app elements
      const hasLedgerElements = await page.$$('text=/账本|Ledger/i');
      const hasExpenseElements = await page.$$('text=/支出|Expense/i');
      const hasSettingsElements = await page.$$('text=/设置|Settings/i');

      const contentInfo = {
        mainElement: !!mainContent,
        headerElement: !!headerContent,
        navElement: !!navContent,
        visibleTextLines: textLines.length,
        hasLedgerContent: hasLedgerElements.length > 0,
        hasExpenseContent: hasExpenseElements.length > 0,
        hasSettingsContent: hasSettingsElements.length > 0,
        sampleText: textLines.slice(0, 5).join(' | ')
      };

      console.log(`- **Expected**: Page has meaningful content structure`);
      console.log(`- **Actual**:`);
      console.log(`  - Main element: ${contentInfo.mainElement}`);
      console.log(`  - Header element: ${contentInfo.headerElement}`);
      console.log(`  - Nav element: ${contentInfo.navElement}`);
      console.log(`  - Visible text lines: ${contentInfo.visibleTextLines}`);
      console.log(`  - Has Ledger content: ${contentInfo.hasLedgerContent}`);
      console.log(`  - Has Expense content: ${contentInfo.hasExpenseContent}`);
      console.log(`  - Has Settings content: ${contentInfo.hasSettingsContent}`);
      console.log(`  - Sample text: "${contentInfo.sampleText}"`);

      const hasGoodContent = contentInfo.visibleTextLines > 3 || contentInfo.hasLedgerContent || contentInfo.hasExpenseContent;

      if (hasGoodContent) {
        console.log('- **Status**: PASS');
        addTestCase('Page Content Structure', 'Analyze page structure', 'Meaningful content present', JSON.stringify(contentInfo), 'PASS');
      } else {
        console.log('- **Status**: FAIL - Page appears empty or lacks content');
        addTestCase('Page Content Structure', 'Analyze page structure', 'Meaningful content present', JSON.stringify(contentInfo), 'FAIL');
      }
      console.log('');
    } catch (error) {
      console.log(`- **Status**: FAIL - ${error.message}`);
      addTestCase('Page Content Structure', 'Analyze page structure', 'Meaningful content present', `Error: ${error.message}`, 'FAIL');
      console.log('');
    }

    // ============================================
    // TC5: Check for Blank Page Issue
    // ============================================
    console.log('#### TC5: Blank Page Detection');
    console.log('- **Command**: `Check if page is blank`');

    try {
      const rootHtml = await page.locator('#root').innerHTML();
      const bodyHtml = await page.locator('body').innerHTML();

      // Check for React error boundaries or errors
      const hasErrorBoundary = await page.$('[class*="error"]') !== null;
      const hasLoadingState = await page.$('[class*="loading"]') !== null || await page.$('text=/加载|Loading/i') !== null;

      const isBlank = rootHtml.trim().length < 50;

      const screenshot5 = `${SCREENSHOT_DIR}/05-blank-check.png`;
      await page.screenshot({ path: screenshot5, fullPage: true });

      if (isBlank) {
        console.log(`- **Expected**: Page should not be blank`);
        console.log(`- **Actual**: Page appears BLANK. Root HTML length: ${rootHtml.length}`);
        console.log('- **Status**: FAIL - BLANK PAGE DETECTED');
        addTestCase('Blank Page Detection', 'Check if page is blank', 'Page not blank', `Blank page detected. Root length: ${rootHtml.length}`, 'FAIL');
      } else if (hasErrorBoundary) {
        console.log(`- **Expected**: Page should not have errors`);
        console.log(`- **Actual**: Error boundary or error state detected`);
        console.log('- **Status**: FAIL - ERROR STATE DETECTED');
        addTestCase('Blank Page Detection', 'Check if page is blank', 'Page not blank', 'Error state detected', 'FAIL');
      } else if (hasLoadingState) {
        console.log(`- **Expected**: Page should be fully loaded`);
        console.log(`- **Actual**: Loading state detected - may be waiting for data`);
        console.log('- **Status**: INFO - Loading state');
        addTestCase('Blank Page Detection', 'Check if page is blank', 'Page not blank', 'Loading state detected', 'INFO');
      } else {
        console.log(`- **Expected**: Page should not be blank`);
        console.log(`- **Actual**: Page has content. Root HTML length: ${rootHtml.length}`);
        console.log('- **Status**: PASS');
        addTestCase('Blank Page Detection', 'Check if page is blank', 'Page not blank', `Content present. Root length: ${rootHtml.length}`, 'PASS');
      }
      console.log('');
    } catch (error) {
      console.log(`- **Status**: FAIL - ${error.message}`);
      addTestCase('Blank Page Detection', 'Check if page is blank', 'Page not blank', `Error: ${error.message}`, 'FAIL');
      console.log('');
    }

    // ============================================
    // TC6: Firebase Auth State Check
    // ============================================
    console.log('#### TC6: Firebase Auth State Check');
    console.log('- **Command**: `Check Firebase authentication state`');

    try {
      // Check for Firebase app initialization
      const firebaseCheck = await page.evaluate(() => {
        return {
          hasFirebase: typeof window.firebase !== 'undefined',
          hasFirebaseApp: typeof window.firebase?.app !== 'undefined',
          localStorageKeys: Object.keys(localStorage),
          hasAuthUser: localStorage.getItem('firebase:authUser') !== null
        };
      });

      const screenshot6 = `${SCREENSHOT_DIR}/06-auth-state.png`;
      await page.screenshot({ path: screenshot6, fullPage: true });

      console.log(`- **Expected**: Firebase properly initialized`);
      console.log(`- **Actual**:`);
      console.log(`  - Firebase present: ${firebaseCheck.hasFirebase}`);
      console.log(`  - Firebase App: ${firebaseCheck.hasFirebaseApp}`);
      console.log(`  - Has Auth User in localStorage: ${firebaseCheck.hasAuthUser}`);
      console.log(`  - LocalStorage keys: ${firebaseCheck.localStorageKeys.join(', ')}`);

      console.log('- **Status**: INFO - Auth state logged');
      addTestCase('Firebase Auth State', 'Check Firebase state', 'Firebase initialized', JSON.stringify(firebaseCheck), 'INFO');
      console.log('');
    } catch (error) {
      console.log(`- **Status**: INFO - ${error.message}`);
      addTestCase('Firebase Auth State', 'Check Firebase state', 'Firebase initialized', `Error: ${error.message}`, 'INFO');
      console.log('');
    }

  } catch (error) {
    console.log(`Test execution error: ${error.message}`);
  } finally {
    await browser.close();
  }

  // Summary
  console.log('### Summary');
  const passed = testResults.testCases.filter(tc => tc.status === 'PASS').length;
  const failed = testResults.testCases.filter(tc => tc.status === 'FAIL').length;
  const info = testResults.testCases.filter(tc => tc.status === 'INFO').length;

  console.log(`- Total: ${testResults.testCases.length} tests`);
  console.log(`- Passed: ${passed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Info: ${info}`);
  console.log('');

  console.log('### Cleanup');
  console.log('- Session ended: Browser closed');
  console.log(`- Screenshots saved to: ${SCREENSHOT_DIR}`);

  // Save test results
  testResults.endTime = new Date().toISOString();
  testResults.summary = { total: testResults.testCases.length, passed, failed, info };

  fs.writeFileSync(
    `${SCREENSHOT_DIR}/test-results.json`,
    JSON.stringify(testResults, null, 2)
  );

  console.log(`- Test results saved to: ${SCREENSHOT_DIR}/test-results.json`);
})();
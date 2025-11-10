#!/usr/bin/env node

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLI Test Runner for Flock XR API Tests
 * Runs mocha tests in tests.html using Playwright headless browser
 */

// Available test suites (from tests/tests.html)
// Note: 228 tests total are registered, but most are tagged
const AVAILABLE_SUITES = [
  { id: '@notslow', name: '🚀 Run Most Tests (97 tests, ~1s)', pattern: '/^(?!.*@slow).*$/' },
  { id: '@onlyslow', name: '🐌 Run Slow Tests Only', pattern: '@slow' },
  { id: '@new', name: '🆕 Run Tests tagged @new', pattern: '@new' },
  { id: 'babylon', name: 'Basic Babylon Tests (3 tests)', pattern: 'Flock API Tests' },
  { id: 'sound', name: 'Sound Tests (1 test)', pattern: '@sound' },
  { id: 'physics', name: 'Physics Tests (6 tests)', pattern: '@physics' },
  { id: 'materials', name: 'Materials Tests (22 tests)', pattern: '@materials' },
  { id: 'effects', name: 'Effects Tests (3 tests)', pattern: 'Effects API' },
  { id: 'scale', name: 'Scale Tests (45 tests)', pattern: '@scale' },
  { id: 'rotation', name: 'Rotation Tests', pattern: '@rotation' },
  { id: 'translation', name: 'Translation/Movement Tests', pattern: '@translation' },
  { id: 'animate', name: 'Animation API Tests', pattern: 'Animation API Tests' },
  { id: 'glide', name: 'Glide Animation Tests', pattern: 'glideTo function tests' },
  { id: 'ui', name: 'UI Text/Button Tests', pattern: 'UIText, UIButton, UIInput, and UISlider function tests' },
  { id: 'stress', name: 'Stress Tests (Boxes)', pattern: 'Stress test for many boxes' },
  { id: 'objects', name: 'Object Creation Tests', pattern: 'createObject tests' },
  { id: 'concurrency', name: 'Concurrency Tests', pattern: 'Concurrency and Stress Tests' },
  { id: 'blocks', name: 'Block Tests', pattern: 'blocks.js tests' }
];

const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');
const watch = args.includes('--watch');
const verbose = args.includes('--verbose') || args.includes('-v');
const logTests = args.includes('--log-tests');
const logApi = args.includes('--log-api');
const logAll = args.includes('--log-all');
const suite = args.find(arg => !arg.startsWith('--')) || 'all';

// Enable both logs if --log-all is specified
if (logAll) {
  console.log('📊 Logging enabled: Tests + API calls\n');
}

if (showHelp) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║             Flock XR API Test Runner - Help                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Usage: npm run test:api [suite] [options]\n');

  console.log('Available Test Suites:');
  console.log('─────────────────────────────────────────────────────────────────\n');

  AVAILABLE_SUITES.forEach(s => {
    const paddedId = s.id.padEnd(15);
    console.log(`  ${paddedId} ${s.name}`);
  });

  console.log('\nOptions:');
  console.log('  --help, -h       Show this help message');
  console.log('  --verbose, -v    Show detailed output');
  console.log('  --log-tests      Log which tests are executed (saves to logs/tests.log)');
  console.log('  --log-api        Log API method calls with counters (saves to logs/api-calls.log)');
  console.log('  --log-all        Enable both test and API logging');
  console.log('  --watch          Watch mode (not yet implemented)');

  console.log('\nExamples:');
  console.log('  npm run test:api                         # Run all tests');
  console.log('  npm run test:api babylon                 # Run Basic Babylon Tests');
  console.log('  npm run test:api sound                   # Run Sound Tests');
  console.log('  npm run test:api @onlyslow -- --log-all  # Run slow tests with logging');
  console.log('  npm run test:api materials -- --log-api  # Log API calls only');
  console.log('  npm run test:api -- --help               # Show this help');

  console.log('\nLogging:');
  console.log('  Test logs:      logs/test-execution.log  (which tests ran)');
  console.log('  API call logs:  logs/api-calls.log       (which API methods called)');
  console.log('  View logs:      cat logs/test-execution.log\n');

  process.exit(0);
}

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║             Flock XR API Test Runner                          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

if (watch) {
  console.log('⚠️  Watch mode not yet implemented\n');
}

let server;
let browser;
let serverReady = false;

/**
 * Start the Vite development server
 */
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting development server...');

    server = spawn('npm', ['run', 'dev'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      shell: true
    });

    server.stdout.on('data', (data) => {
      const output = data.toString();

      // Look for Vite server ready message
      if (output.includes('Local:') && !serverReady) {
        serverReady = true;
        console.log('✅ Development server started\n');
        resolve();
      }
    });

    server.stderr.on('data', (data) => {
      // Vite outputs to stderr for some messages
      const output = data.toString();
      if (output.includes('Local:') && !serverReady) {
        serverReady = true;
        console.log('✅ Development server started\n');
        resolve();
      }
    });

    server.on('error', (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

/**
 * Run tests in headless browser
 */
async function runTests(suiteId = 'all') {
  console.log('🌐 Launching headless browser...');

  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Inject script to expose flock globally when it's created
  if (logApi || logAll) {
    await page.addInitScript(() => {
      // Override the module import to expose flock globally
      const originalImport = window.__import;

      // Hook into module loading to capture flock when it's imported
      const observer = new MutationObserver(() => {
        const iframe = document.getElementById('flock-iframe');
        if (iframe && iframe.contentWindow && iframe.contentWindow.flock) {
          window.__testFlock = iframe.contentWindow.flock;
          observer.disconnect();
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    });
  }

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Navigate to test page
  console.log('📄 Loading test page...');
  await page.goto('http://localhost:5173/tests/tests.html', {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  // Wait for test infrastructure to be ready
  console.log('⏳ Waiting for test page to load...');
  try {
    // First wait for mocha to be available
    await page.waitForFunction(() => {
      return typeof window.mocha !== 'undefined' &&
             document.getElementById('testSelect') !== null;
    }, { timeout: 30000 });

    console.log('✅ Test page loaded');

    // Then wait for flock to initialize
    console.log('⏳ Waiting for Flock to initialize...');

    // First wait for flock object to exist
    await page.waitForFunction(() => {
      return typeof window.flock !== 'undefined';
    }, { timeout: 30000 });

    console.log('   ✓ Flock object available');

    // Wait for flock initialization to complete
    // The test page puts flock in an iframe, so we need to check if initialization finished
    // by waiting for test definitions to be loaded (which happens after flock init)
    console.log('   ✓ Waiting for test suite definitions...');

    await page.waitForFunction(() => {
      // Check if test suites have been loaded (they load after flock initializes)
      const testSelect = document.getElementById('testSelect');
      if (!testSelect) return false;

      // Test suite options are added after initialization
      const options = testSelect.querySelectorAll('option');
      return options.length > 2; // More than just the default placeholder options
    }, { timeout: 90000 });

    console.log('✅ Flock initialized and tests loaded\n');

  } catch (error) {
    console.error('❌ Failed to load test page');
    console.error('\nRecent console messages:');
    consoleMessages.slice(-15).forEach(msg => {
      const prefix = msg.type === 'error' ? '❌' :
                    msg.type === 'warning' ? '⚠️ ' : '  ';
      console.log(`  ${prefix} [${msg.type}] ${msg.text}`);
    });
    throw error;
  }

  // Find suite info for diagnostics
  const suiteInfo = AVAILABLE_SUITES.find(s => s.id === suiteId);
  const patternInfo = suiteInfo ? suiteInfo.pattern : 'unknown';

  // Select test suite
  console.log(`🧪 Running test suite: ${suiteId}`);
  if (verbose) {
    console.log(`   Suite: ${suiteInfo?.name || 'Unknown'}`);
    console.log(`   Pattern: ${patternInfo || 'none (all tests)'}`);
  }
  console.log();

  await page.selectOption('#testSelect', suiteId);

  // Wait for the selection to register and grep filter to be applied
  await page.waitForTimeout(1000);

  // Wait for mocha to update its test count after grep is applied
  let matchedTests = 0;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const testCount = await page.evaluate(() => {
      // Mocha suite.total() includes all tests, we need filtered count
      if (window.mocha && window.mocha.options.grep) {
        const grep = window.mocha.options.grep;
        let count = 0;

        function countMatchingTests(suite) {
          suite.tests.forEach(test => {
            const title = test.fullTitle();
            if (grep.test(title)) {
              count++;
            }
          });
          suite.suites.forEach(s => countMatchingTests(s));
        }

        if (window.mocha.suite) {
          countMatchingTests(window.mocha.suite);
        }
        return count;
      }
      return window.mocha?.suite?.total() || 0;
    });

    if (testCount > 0) {
      matchedTests = testCount;
      break;
    }

    await page.waitForTimeout(200);
    attempts++;
  }

  if (verbose || matchedTests === 0) {
    const preRunState = await page.evaluate(() => {
      return {
        mochaExists: typeof window.mocha !== 'undefined',
        grepValue: window.mocha?.options?.grep?.toString(),
        totalRegistered: window.mocha?.suite?.total(),
      };
    });
    console.log('   Pre-run mocha state:', JSON.stringify(preRunState, null, 2));
    console.log(`   Matching tests found: ${matchedTests}`);

    if (matchedTests === 0) {
      console.warn('   ⚠️  Warning: No tests match the pattern. They may not be registered yet.');
    }
  }

  // Set up logging if requested
  if (logTests || logAll) {
    await page.evaluate(() => {
      window.testExecutionLog = [];
      window.testExecutionLog.push('=== Test Execution Log ===');
      window.testExecutionLog.push(`Suite: ${document.getElementById('testSelect').value}`);
      window.testExecutionLog.push(`Started: ${new Date().toISOString()}`);
      window.testExecutionLog.push('');
    });
  }

  if (logApi || logAll) {
    const diagnostics = await page.evaluate(() => {
      window.apiCallLog = [];
      window.apiCallCounts = {};
      window.apiCallLog.push('=== API Call Log ===');
      window.apiCallLog.push(`Suite: ${document.getElementById('testSelect').value}`);
      window.apiCallLog.push(`Started: ${new Date().toISOString()}`);
      window.apiCallLog.push('');

      // Access flock from the window (exposed by tests.html)
      const flock = window.__flockForLogging;

      if (!flock) {
        return {
          error: 'Flock not found - window.__flockForLogging is not set',
          flockExists: false
        };
      }

      // Diagnostic info
      const diag = {
        flockExists: true,
        methodCount: 0,
        wrappedMethods: []
      };

      // Store original methods in the main window (so they survive test runs)
      if (!window._originalFlockMethods) {
        window._originalFlockMethods = {};
      }

      // Iterate over all own properties and prototype methods
      const allProps = [
        ...Object.keys(flock),  // Own properties
        ...Object.getOwnPropertyNames(Object.getPrototypeOf(flock) || {})  // Prototype
      ];

      for (const prop of allProps) {
        try {
          if (typeof flock[prop] === 'function' && prop !== 'constructor') {
            diag.methodCount++;
            if (diag.wrappedMethods.length < 10) {
              diag.wrappedMethods.push(prop);
            }

            // Store original method
            if (!window._originalFlockMethods[prop]) {
              window._originalFlockMethods[prop] = flock[prop].bind(flock);
            }

            // Wrap the method in place
            flock[prop] = (function(methodName, originalMethod) {
              return function(...args) {
                // Increment counter
                if (!window.apiCallCounts[methodName]) {
                  window.apiCallCounts[methodName] = 0;
                }
                window.apiCallCounts[methodName]++;

                // Log the call
                const count = window.apiCallCounts[methodName];
                const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
                try {
                  const argsStr = args.length > 0 ? JSON.stringify(args).slice(0, 100) : '()';
                  window.apiCallLog.push(`[${timestamp}] ${methodName} (#${count}) ${argsStr}`);
                } catch (e) {
                  window.apiCallLog.push(`[${timestamp}] ${methodName} (#${count})`);
                }

                // Call the original function
                return originalMethod.apply(this, args);
              };
            })(prop, window._originalFlockMethods[prop]);
          }
        } catch (e) {
          // Skip properties that can't be accessed
        }
      }

      return diag;
    });

    if (verbose) {
      console.log('   API Logging diagnostics:', JSON.stringify(diagnostics, null, 2));
    }
  }

  // Set up test execution logging BEFORE clicking run
  if (logTests || logAll) {
    await page.evaluate(() => {
      // Mocha is in the main window, not the iframe
      if (window.mocha) {
        // Wrap mocha.run() to intercept the runner
        const originalRun = window.mocha.run.bind(window.mocha);
        window.mocha.run = function(...args) {
          const runner = originalRun(...args);

          // Attach our logging hooks to the runner
          runner.on('test', function(test) {
            window.testExecutionLog.push(`▶ START: ${test.fullTitle()}`);
          });

          runner.on('pass', function(test) {
            window.testExecutionLog.push(`  ✅ PASS: ${test.fullTitle()} (${test.duration}ms)`);
          });

          runner.on('fail', function(test, err) {
            window.testExecutionLog.push(`  ❌ FAIL: ${test.fullTitle()}`);
            window.testExecutionLog.push(`     Error: ${err.message}`);
          });

          runner.on('end', function() {
            window.testExecutionLog.push('');
            window.testExecutionLog.push('=== Test Execution Complete ===');
            window.testExecutionLog.push(`Completed: ${new Date().toISOString()}`);
          });

          return runner;
        };
      }
    });
  }

  // Click run button
  await page.click('#runTestBtn');

  // Wait for tests to start running
  await page.waitForTimeout(1500);

  // Wait for tests to complete
  console.log('⏳ Running tests...\n');

  const results = await page.waitForFunction((expectedCount) => {
    const stats = document.querySelector('#mocha-stats');
    if (!stats) return null;

    const duration = stats.querySelector('.duration em');
    if (!duration || duration.textContent === '') return null;

    // Tests are complete
    const passes = parseInt(stats.querySelector('.passes em').textContent) || 0;
    const failures = parseInt(stats.querySelector('.failures em').textContent) || 0;
    const total = passes + failures;

    // Only return results if all expected tests have completed
    if (total < expectedCount) {
      return null; // Keep waiting
    }

    // Get failure details
    const failureElements = Array.from(document.querySelectorAll('.test.fail'));
    const failureDetails = failureElements.map(el => {
      const titleEl = el.querySelector('h2');
      const errorEl = el.querySelector('.error');

      return {
        title: titleEl ? titleEl.textContent : 'Unknown test',
        error: errorEl ? errorEl.textContent : 'No error message'
      };
    });

    return {
      passes,
      failures,
      total,
      duration: duration.textContent,
      failureDetails
    };
  }, matchedTests, { timeout: 120000 }); // Pass expected test count as arg, 2 minute timeout

  const testResults = await results.jsonValue();

  // Print results
  console.log('┌─────────────────────────────────────────┐');
  console.log('│              Test Results               │');
  console.log('└─────────────────────────────────────────┘\n');

  console.log(`  Total Tests:     ${testResults.total}`);
  console.log(`  ✅ Passing:      ${testResults.passes}`);
  console.log(`  ❌ Failing:      ${testResults.failures}`);
  console.log(`  ⏱️  Duration:     ${testResults.duration}\n`);

  if (testResults.failures > 0) {
    console.log('┌─────────────────────────────────────────┐');
    console.log('│              Failed Tests               │');
    console.log('└─────────────────────────────────────────┘\n');

    testResults.failureDetails.forEach((failure, index) => {
      console.log(`  ${index + 1}. ${failure.title}`);
      console.log(`     Error: ${failure.error}\n`);
    });
  }

  // Retrieve and save logs if logging was enabled
  if (logTests || logAll) {
    const testLog = await page.evaluate(() => {
      return window.testExecutionLog ? window.testExecutionLog.join('\n') : '';
    });

    if (testLog) {
      const logsDir = path.resolve(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const testLogPath = path.join(logsDir, 'test-execution.log');
      fs.writeFileSync(testLogPath, testLog);
      console.log(`📝 Test execution log saved to: ${testLogPath}\n`);
    }
  }

  if (logApi || logAll) {
    const apiLog = await page.evaluate(() => {
      return window.apiCallLog ? window.apiCallLog.join('\n') : '';
    });

    const apiCounts = await page.evaluate(() => {
      return window.apiCallCounts || {};
    });

    if (apiLog) {
      const logsDir = path.resolve(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Save detailed API call log
      const apiLogPath = path.join(logsDir, 'api-calls.log');
      let fullLog = apiLog + '\n\n';
      fullLog += '=== API Call Summary ===\n';
      fullLog += 'Method Call Counts:\n';

      const sortedCounts = Object.entries(apiCounts).sort((a, b) => b[1] - a[1]);
      sortedCounts.forEach(([method, count]) => {
        fullLog += `  ${method}: ${count}\n`;
      });

      fs.writeFileSync(apiLogPath, fullLog);
      console.log(`📝 API call log saved to: ${apiLogPath}`);

      // Print summary
      if (sortedCounts.length > 0) {
        console.log('\n📊 API Call Summary:');
        sortedCounts.slice(0, 10).forEach(([method, count]) => {
          console.log(`   ${method}: ${count} call${count > 1 ? 's' : ''}`);
        });
        if (sortedCounts.length > 10) {
          console.log(`   ... and ${sortedCounts.length - 10} more methods`);
        }
        console.log();
      }
    }
  }

  await browser.close();

  return {
    success: testResults.failures === 0,
    stats: testResults
  };
}

/**
 * Cleanup and exit
 */
function cleanup() {
  if (server) {
    console.log('\n🛑 Stopping development server...');
    server.kill();
  }
  if (browser) {
    browser.close().catch(() => {});
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Start server
    await startServer();

    // Give server a moment to fully start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run tests
    const { success, stats } = await runTests(suite);

    // Cleanup
    cleanup();

    // Exit with appropriate code
    if (success) {
      console.log('✅ All tests passed!\n');
      process.exit(0);
    } else {
      console.log(`❌ ${stats.failures} test(s) failed\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    console.error(error.stack);
    cleanup();
    process.exit(1);
  }
}

// Handle interrupts
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test run interrupted by user');
  cleanup();
  process.exit(1);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});

// Run
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  cleanup();
  process.exit(1);
});

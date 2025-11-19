# Test Runner Logging Implementation

**Date:** 2025-11-05 (Updated: 2025-11-10)
**Status:** ✅ Complete - Logging Operational | @onlyslow Issue Resolved

## 🎯 Purpose

Add logging to the CLI test runner to investigate why `@onlyslow` finds 94 matching tests but only runs 1.

**Outcome:** Logging infrastructure successfully helped identify and resolve the test runner issue. All 94 @onlyslow tests now run successfully.

## ✅ Implemented Features

### 1. Test Execution Logging

**Status:** ✅ **WORKING**

Logs which tests are actually executed, including:
- Test start events
- Pass/fail status
- Execution duration
- Error messages for failures

**Usage:**
```bash
# Enable test execution logging only
npm run test:api <suite> -- --log-tests

# Example
npm run test:api @onlyslow -- --log-tests
```

**Output Location:** `logs/test-execution.log`

**Example Log:**
```
=== Test Execution Log ===
Suite: @onlyslow
Started: 2025-11-05T16:00:28.307Z

▶ START: glideTo function tests @slow should move the box to the correct position @slow
  ✅ PASS: glideTo function tests @slow should move the box to the correct position @slow (513ms)
▶ START: glideTo function tests @slow should handle reverse movement @slow

=== Test Execution Complete ===
Completed: 2025-11-05T16:00:29.123Z
```

### 2. Combined Logging

**Usage:**
```bash
# Enable both test and API logging
npm run test:api <suite> -- --log-all
```

### 3. Help Documentation

All logging options are documented in the help:
```bash
npm run test:api -- --help
```

### 2. API Call Logging

**Status:** ✅ **WORKING**

Logs which API methods are called during test execution, including:
- Method name
- Call counter (incremental)
- Timestamp
- Arguments passed (truncated to 100 chars)
- Summary of most-called methods

**Usage:**
```bash
# Enable API call logging only
npm run test:api <suite> -- --log-api

# Example
npm run test:api babylon -- --log-api
```

**Output Location:** `logs/api-calls.log`

**Example Log:**
```
=== API Call Log ===
Suite: babylon
Started: 2025-11-05T16:58:53.406Z

[16:58:53.418] getAudioContext (#1) ()
[16:58:53.418] updateListenerPositionAndOrientation (#1)
[16:58:53.468] setSky (#1) ["#6495ed"]
[16:58:53.468] getColorFromString (#1) ["#6495ed"]
[16:58:53.475] createBox (#1) ["box__1",{"color":"#996633","width":4,"height":0.5,"depth":4,"position":[-4,0.5,0]}]
[16:58:53.475] getOrCreateGeometry (#1)
[16:58:53.476] setSizeBasedBoxUVs (#1)
[16:58:53.477] initializeMesh (#1)
[16:58:53.477] applyMaterialToMesh (#1)

=== API Call Summary ===
Method Call Counts:
  getAudioContext: 91
  updateListenerPositionAndOrientation: 91
  getColorFromString: 3
  createBox: 2
  getOrCreateGeometry: 2
  setSizeBasedBoxUVs: 2
  initializeMesh: 2
  applyMaterialToMesh: 2
  applyPhysics: 2
  announceMeshReady: 2
```

**Console Output:**
After tests complete, shows top 10 most-called methods:
```
📊 API Call Summary:
   getAudioContext: 91 calls
   updateListenerPositionAndOrientation: 91 calls
   getColorFromString: 3 calls
   createBox: 2 calls
```

**Implementation:**
- Modified `tests/tests.html` line 139 to expose flock globally: `window.__flockForLogging = flock;`
- Wraps all flock methods (224 methods wrapped)
- Uses closures to maintain call counters
- Stores logs in `window.apiCallLog` array during execution
- Saves to file after tests complete

## 🔍 Key Finding: @onlyslow Issue ✅ RESOLVED

**Original Problem:** `@onlyslow` finds 94 tests but only 1 completes

**Root Cause Identified:** Test runner was exiting prematurely before all tests completed. The `waitForFunction` in `scripts/run-api-tests.mjs` was checking if `window.testRunComplete === true`, which would become true after the FIRST test finished in some scenarios.

**Solution:** Updated `waitForFunction` to properly wait for ALL tests to complete by checking the mocha runner state more accurately.

**Resolution Date:** 2025-11-05

**Current Status:**
```
✅ @onlyslow: 94 tests found, 94 tests running
✅ Test Results: 89 passing, 5 failing (legitimate test failures, not runner issues)
```

**Additional Fix Required:** HTTP 500 error preventing Flock initialization was also discovered and fixed by running `npm install` to add missing dependencies.

**Details:** See `docs/SLOW_TEST_FIX_COMPLETE.md` and `docs/CLI_TEST_RUNNER_STATUS.md`

## 📋 Command Reference

### Logging Flags

| Flag | Description | Output File |
|------|-------------|-------------|
| `--log-tests` | Log test execution | `logs/test-execution.log` ✅ Working |
| `--log-api` | Log API method calls | `logs/api-calls.log` ✅ Working |
| `--log-all` | Enable both logs | Both files ✅ Working |

### Examples

```bash
# Test execution logging only
npm run test:api babylon -- --log-tests

# Combined with verbose mode
npm run test:api @onlyslow -- --log-tests --verbose

# All logging (API logging not yet functional)
npm run test:api materials -- --log-all

# View logs
cat logs/test-execution.log
```

## 🔧 Implementation Details

### Test Execution Logging

**Method:** Wraps `mocha.run()` to intercept the runner and attach event listeners

**Code Location:** `scripts/run-api-tests.mjs` lines 402-424

**How It Works:**
1. Before clicking "Run Tests", wraps `window.mocha.run()`
2. When run() is called, attaches event listeners to the runner:
   - `test` - logs when test starts
   - `pass` - logs when test passes with duration
   - `fail` - logs when test fails with error message
   - `end` - logs completion
3. Logs are stored in `window.testExecutionLog` array
4. After tests complete, logs are saved to file

**Key Code:**
```javascript
window.mocha.run = function(...args) {
  const runner = originalRun(...args);

  runner.on('test', function(test) {
    window.testExecutionLog.push(`▶ START: ${test.fullTitle()}`);
  });

  runner.on('pass', function(test) {
    window.testExecutionLog.push(`  ✅ PASS: ${test.fullTitle()} (${test.duration}ms)`);
  });

  // ... more event handlers

  return runner;
};
```

### API Call Logging

**Status:** ✅ Fully functional

**Method:** Wraps flock object methods in-place to intercept calls

**Implementation:**
- Exposed flock globally via `window.__flockForLogging` in tests.html (line 139)
- Wraps all 224 flock methods using closures
- Maintains call counters and timestamps for each method
- Logs arguments (truncated to 100 chars to prevent huge logs)
- Saves detailed log to file and prints summary to console

## 🚀 Next Steps ✅ COMPLETED

### Investigation of @onlyslow Issue - RESOLVED

1. ✅ **Confirmed:** Only 1 test completes despite 94 matching
2. ✅ **Identified:** Second test starts but doesn't complete
3. ✅ **DONE:** Investigated and found test runner's `waitForFunction` was exiting too early
4. ✅ **DONE:** Fixed by updating wait condition to properly check for all tests complete
5. ✅ **DONE:** Fixed HTTP 500 error by running `npm install` for missing dependencies
6. ✅ **DONE:** Verified all 94 @onlyslow tests now run successfully

### Current State

All infrastructure is now operational. Ready for Phase 2:
- Add JSDoc to API source files
- Write tests for untested categories (Mesh, Camera, Movement, Shapes)
- Increase test coverage from 49% to 80%+

## 📊 Test Results Summary

| Suite | Matching | Actual Runs | Status |
|-------|----------|-------------|---------|
| babylon | 3 | 3 | ✅ Working |
| materials | 22 | 22 | ✅ Working |
| @onlyslow | 94 | 94 | ✅ Fixed - All running (89 passing, 5 failing) |
| glide | 5 | 5 | ✅ Working |
| stress | 1 | 1 | ✅ Working |

## 🎓 Lessons Learned

1. **ES Modules have isolated scope** - Variables in `<script type="module">` are not global
2. **Mocha events are powerful** - Can hook into test lifecycle for detailed logging
3. **Playwright page.evaluate runs in page context** - Cannot access module-scoped variables
4. **Test execution logging is easier than API logging** - Mocha is globally accessible, flock is not
5. **Incremental development wins** - Test execution logging works and provides value, even though API logging doesn't yet
6. **Logging infrastructure proved invaluable** - Helped identify the real issue was in the test runner, not the test code
7. **Correlation doesn't equal causation** - Initial hypothesis about setInterval was wrong; actual issue was test runner's wait condition
8. **Always check dependencies** - `npm install` resolved HTTP 500 error by adding missing runtime dependencies

## 📝 Conclusion

**Both logging features are fully functional and served their purpose!**

✅ **Test Execution Logging** - Tracks which tests start, pass, fail, and their duration
✅ **API Call Logging** - Tracks which API methods are called with timestamps and counters

**Key Finding (RESOLVED):** The logging infrastructure helped identify that the @onlyslow issue was NOT in the test code itself, but in the test runner's premature exit condition.

**Resolution:**
- ✅ Test runner fixed: Updated `waitForFunction` to properly wait for all tests to complete
- ✅ HTTP 500 fixed: Added missing dependencies via `npm install`
- ✅ All 94 @onlyslow tests now run successfully (89 passing, 5 legitimate failures)

**Impact:**
- Logging infrastructure remains available for future debugging
- CLI test runner is now 100% operational
- Ready to proceed with Phase 2 (adding JSDoc and writing tests)

**Related Documentation:**
- `docs/SLOW_TEST_FIX_COMPLETE.md` - Details of the fix
- `docs/CLI_TEST_RUNNER_STATUS.md` - Current test runner status
- `docs/IMPLEMENTATION_STATUS.md` - Overall project status

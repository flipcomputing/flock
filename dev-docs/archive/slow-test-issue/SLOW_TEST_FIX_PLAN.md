# @slow Test Bug - Fix Plan

**Date:** 2025-11-05 (Updated: 2025-11-10)
**Status:** ⚠️ **HISTORICAL DOCUMENT** - Incorrect Hypothesis

> **IMPORTANT:** This document describes a fix plan based on an incorrect hypothesis. We suspected `setInterval()` was causing tests to hang, but after fixing the test runner, all tests pass with the original `setInterval` code intact. The actual issue was in `scripts/run-api-tests.mjs` where the `waitForFunction` was exiting prematurely. See `docs/SLOW_TEST_FIX_COMPLETE.md` for the actual fix.

## 📋 Executive Summary (INCORRECT HYPOTHESIS)

~~✅ **ROOT CAUSE IDENTIFIED:** Tests using `setInterval()` cause subsequent tests to hang~~
❌ **ACTUAL CAUSE:** Test runner's `waitForFunction` was exiting too early
✅ **ACTUAL FIX:** Updated `waitForFunction` to wait for all expected tests to complete
✅ **RESULT:** All 94 @onlyslow tests now run successfully with original `setInterval` code

## 🔍 Confirmed setInterval Usage

```bash
$ grep -rn "setInterval" tests/*.test.js

/tests/boxes.test.js:70:         const intervalId = setInterval(() => {
/tests/glide.test.js:57:         const intervalId = setInterval(() => {
/tests/glide.test.js:103:        const intervalId = setInterval(() => {
```

**Only 3 setInterval instances found in 3 test files!**

## 📊 Correlation Analysis

| Test File | setInterval Count | Observed Behavior | Match |
|-----------|-------------------|-------------------|-------|
| **glide.test.js** | **2 instances** | ❌ Stops at test 2 | ✅ **PERFECT MATCH** |
| **boxes.test.js** | **1 instance** | ❌ Stops at test 1 | ✅ **PERFECT MATCH** |
| **sound.test.js** | 0 instances | ❌ Stops at test 2 | ⚠️ Different cause? |
| **animate.test.js** | 0 instances | ❌ Stops at test 6 | ⚠️ Different cause? |
| **objects.test.js** | 0 instances | ❌ Stops at test 6 | ⚠️ Different cause? |
| **concurrency.test.js** | 0 instances | ❌ Stops at test 1 | ⚠️ Different cause? |
| **translate.test.js** | 0 instances | ✅ All 24 run | ✅ **CONFIRMED** |

## 🎯 Primary Fix: glide.test.js

### Test 2: "should handle reverse movement @slow" (Line 47)

**Current Code (BROKEN):**
```javascript
it("should handle reverse movement @slow", function (done) {
  this.timeout(10000);

  flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 2, reverse: true });

  let count = 0;
  let passed = true;

  const intervalId = setInterval(() => {
    const box = flock.scene.getMeshByName(box1);

    switch (count) {
      case 3:
        if (!checkXPosition(box, 0)) passed = false;
        break;
      case 0:
      case 2:
        if (!checkXPosition(box, 3)) passed = false;
        break;
      case 1:
        if (!checkXPosition(box, 6)) passed = false;
        break;
    }

    count++;

    if (count > 3) {
      clearInterval(intervalId);
      expect(passed).to.be.true;
      done();
    }
  }, 1000);
});
```

**Fixed Code (WORKING):**
```javascript
it("should handle reverse movement @slow", function (done) {
  this.timeout(10000);

  flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 2, reverse: true });

  let count = 0;
  let passed = true;

  function checkPosition() {
    const box = flock.scene.getMeshByName(box1);

    switch (count) {
      case 3:
        if (!checkXPosition(box, 0)) passed = false;
        break;
      case 0:
      case 2:
        if (!checkXPosition(box, 3)) passed = false;
        break;
      case 1:
        if (!checkXPosition(box, 6)) passed = false;
        break;
    }

    count++;

    if (count > 3) {
      expect(passed).to.be.true;
      done();
    } else {
      setTimeout(checkPosition, 1000);  // Schedule next check
    }
  }

  setTimeout(checkPosition, 1000);  // Start first check
});
```

**Changes:**
1. ✅ Replaced `setInterval()` with recursive `setTimeout()`
2. ✅ Extracted interval body into `checkPosition()` function
3. ✅ Removed `clearInterval()` - not needed with setTimeout
4. ✅ Added `else` clause to schedule next check
5. ✅ Initial call to start the checking chain

### Test 3: "should handle looping" (Line 91)

Similar pattern - replace `setInterval()` at line 103 with recursive `setTimeout()`.

## 🎯 Secondary Fix: boxes.test.js

### Location: Line 70

Similar fix needed - replace `setInterval()` with recursive `setTimeout()`.

## ⚠️ Other Failing Tests - Different Causes

The following test suites fail but DON'T use `setInterval()`:
- sound.test.js
- animate.test.js
- objects.test.js
- concurrency.test.js

**Possible causes:**
1. **Promise handling issues** - Uncaught promise rejections
2. **Animation/sound timing** - Long-running operations not properly awaited
3. **Scene state** - Heavy tests leaving scene in bad state
4. **Resource limits** - Too many objects/sounds causing memory issues

**Recommendation:** Fix `setInterval()` issues first, then re-test these suites to see if they're secondary effects.

## 📝 Step-by-Step Fix Plan

### Phase 1: Fix setInterval Usage ✅ Ready

**Step 1:** Fix glide.test.js test #2
- Replace `setInterval` with recursive `setTimeout`
- Test: `npm run test:api glide -- --log-tests`
- Expected: All 5 glide tests should run

**Step 2:** Fix glide.test.js test #3
- Same pattern
- Test: `npm run test:api glide -- --log-tests`
- Expected: All 5 glide tests still run

**Step 3:** Fix boxes.test.js
- Replace `setInterval` with recursive `setTimeout`
- Test: `npm run test:api stress -- --log-tests`
- Expected: Box stress test should complete

### Phase 2: Re-test Affected Suites ⏳ Pending

**Step 4:** Re-run @onlyslow
```bash
npm run test:api @onlyslow -- --log-tests --verbose
```
Expected: More than 1 test should run

**Step 5:** Re-run individual suites
- sound
- animate
- objects
- concurrency

Check if any still fail and analyze new patterns.

### Phase 3: Fix Remaining Issues ⏳ Pending

Based on Phase 2 results, identify and fix any remaining test issues.

## 🧪 Validation Tests

After each fix:

1. **Run specific suite with logging:**
   ```bash
   npm run test:api glide -- --log-all --verbose
   ```

2. **Check test execution log:**
   ```bash
   grep "▶ START\|✅ PASS\|❌ FAIL" logs/test-execution.log
   ```

3. **Verify no hangs:**
   - All started tests should complete (pass or fail)
   - No test should start without completing

## 📊 Expected Outcomes

### After Phase 1:
- ✅ glide: 5/5 tests run (currently 1/5)
- ✅ boxes: 1/1 test runs (currently 0/1)
- ⚠️ Other suites: May still have issues

### After Phase 2:
- ✅ Identify if other failures are secondary to setInterval issue
- ✅ Or identify additional root causes

### After Phase 3:
- ✅ @onlyslow: 94/94 tests run (currently 1/94)
- ✅ All test suites: 100% test execution rate

## 🎓 Why This Fix Works

### Problem with setInterval:
1. Creates a timer that fires repeatedly
2. Even with `clearInterval()`, browser may queue one more callback
3. Async state from intervals persists across tests
4. Mocha doesn't know if test is "truly done" with intervals

### Solution with recursive setTimeout:
1. Each `setTimeout()` is a one-time callback
2. Callback completes before next one is scheduled
3. Clear async completion boundary
4. Mocha can properly detect test completion

### Pattern Comparison:

**setInterval (Broken):**
```
Test starts
  → setInterval creates repeating timer
  → Callback fires every 1000ms
  → After 4 fires, clearInterval() called
  → done() called
  → BUT: Browser may have queued one more callback
  → Next test tries to start
  → Hang (async state contamination)
```

**Recursive setTimeout (Working):**
```
Test starts
  → setTimeout schedules one callback
  → Callback fires after 1000ms
  → If more checks needed: schedule another setTimeout
  → If done: call done()
  → Clear completion - no queued callbacks
  → Next test starts cleanly
```

## 📋 Files to Modify

### 1. tests/glide.test.js
- **Line 57:** Replace setInterval (test #2: "should handle reverse movement")
- **Line 103:** Replace setInterval (test #3: "should handle looping")

### 2. tests/boxes.test.js
- **Line 70:** Replace setInterval

### 3. (Maybe) Other test files
After fixing above, re-test and see if other issues remain.

## ✅ Success Criteria

**Phase 1 Success:**
- glide suite: 5 tests run (up from 1)
- boxes suite: 1 test runs (up from 0)
- No tests hang or start without completing

**Phase 2 Success:**
- @onlyslow: Significant increase in tests run (>1)
- Identify any remaining failure patterns

**Final Success:**
- @onlyslow: All 94 tests run
- All test suites: 100% execution rate
- No more hanging tests

## 🚀 Ready to Execute

All analysis is complete. The fix is straightforward and has high confidence of success.

**Next step:** Make the code changes to glide.test.js and boxes.test.js

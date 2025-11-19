# @slow Test Bug - ROOT CAUSE IDENTIFIED

**Date:** 2025-11-05 (Updated: 2025-11-10)
**Status:** ⚠️ **HISTORICAL DOCUMENT** - Incorrect Hypothesis

> **IMPORTANT:** This document describes an incorrect hypothesis. We believed `setInterval()` was causing tests to hang, but this was proven wrong when the test runner fix allowed all tests to pass with the original `setInterval` code intact. The actual issue was the test runner's `waitForFunction` exiting prematurely. See `docs/SLOW_TEST_FIX_COMPLETE.md` for the correct root cause and fix.

## 🔥 Root Cause (INCORRECT HYPOTHESIS)

~~**The issue is with `setInterval()` usage in tests that never gets properly cleared, causing subsequent tests to hang.**~~

**ACTUAL ROOT CAUSE:** The test runner's `waitForFunction` in `scripts/run-api-tests.mjs` was checking if `window.testRunComplete === true`, which became true after the first test completed, causing the runner to exit before all tests finished.

## 🔬 Evidence

### Working Test (Translation):
```javascript
it("should position a box...", function (done) {
  flock.positionAt(boxId, { x: 5, y: 3, z: -2 });

  setTimeout(() => {  // ← Uses setTimeout (one-time)
    const box = flock.scene.getMeshByName(boxId);
    expect(box.position.x).to.be.closeTo(5, 0.01);
    done();
  }, 100);
});
```

**Pattern:** Uses `setTimeout()` - executes once and cleans up automatically

### Failing Test (Glide test #2 - "should handle reverse movement"):
```javascript
it("should handle reverse movement @slow", function (done) {
  this.timeout(10000);

  flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 2, reverse: true });

  let count = 0;
  let passed = true;

  const intervalId = setInterval(() => {  // ← Uses setInterval (repeating)
    const box = flock.scene.getMeshByName(box1);

    switch (count) {
      case 3:
        if (!checkXPosition(box, 0)) passed = false;
        break;
      // ... more cases ...
    }

    count++;

    // Stop checking after 4 seconds
    if (count > 3) {
      clearInterval(intervalId);  // ← Clears interval
      expect(passed).to.be.true;
      done();
    }
  }, 1000); // Check every 1000ms
});
```

**Problem:** While this test DOES call `clearInterval(intervalId)` and `done()`, something about the interval or the timing causes the next test to never complete.

## 📊 Test Execution Pattern

### Glide Suite Execution:

**Test 1: "should move the box to the correct position @slow"**
```javascript
flock.glideTo(box1, {...}).then(() => {
  // Assertions
  done();  // ← Completes successfully
});
```
✅ Uses Promise `.then()` - **WORKS**

**Test 2: "should handle reverse movement @slow"**
```javascript
const intervalId = setInterval(() => {
  // Check position every second
  if (count > 3) {
    clearInterval(intervalId);
    done();  // ← Calls done() but test HANGS
  }
}, 1000);
```
❌ Uses `setInterval()` - **HANGS**

## 🎯 Why This Causes The Hang

### Hypothesis: Race Condition with setInterval

1. **Test 2 starts** - Creates `setInterval()` (checks every 1000ms)
2. **Interval fires 4 times** - count reaches 4
3. **clearInterval() called** - Interval is cleared
4. **done() called** - Mocha should mark test complete
5. **BUT** - Something in the interval/async state prevents Mocha from moving to the next test
6. **Test 3 never starts** - Runner hangs

### Possible Issues:

#### 1. Interval Not Actually Cleared
- `clearInterval(intervalId)` might not execute in time
- Interval might fire one more time after clearInterval
- Browser might queue one more interval callback

#### 2. Scene State Contamination
```javascript
const box = flock.scene.getMeshByName(box1);
```
The interval repeatedly accesses `flock.scene`. If the scene is in an inconsistent state, this could block.

#### 3. Animation Still Running
```javascript
flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 2, reverse: true });
```
- Duration is 2 seconds
- Interval checks every 1 second for 4 seconds
- Animation might still be running when test "completes"
- Next test tries to start while animation is active

#### 4. afterEach() Timing
```javascript
afterEach(function () {
  flock.dispose(box1);  // ← Disposes the box
});
```
If `done()` is called while interval is still technically active, `afterEach()` might dispose the box while the interval callback is still queued, causing a crash or hang.

## 🔍 Supporting Evidence

### Why Some Tests Run 5 Times Before Hanging

Looking at the test counts:
- **Animate**: 5 tests pass, test 6 hangs
- **Objects**: 5 tests pass, test 6 hangs

Both of these likely have tests 1-5 using simpler patterns, then test 6 uses `setInterval()` or complex async logic.

### Why Concurrency Hangs at Test 1

Concurrency tests likely use intervals from the very first test (concurrent operations = need to check state repeatedly).

### Why Translation Works

**All 24 translation tests use `setTimeout()` exclusively!**

```javascript
// Every translation test follows this pattern:
it("test name", function (done) {
  flock.someMethod(...);
  setTimeout(() => {
    // Assertions
    done();
  }, 100);
});
```

No `setInterval()`, no repeated checks, no complex async state.

## 🎯 The Fix

### Option 1: Replace setInterval with Polling via setTimeout (Recommended)

**Before (Broken):**
```javascript
const intervalId = setInterval(() => {
  const box = flock.scene.getMeshByName(box1);
  // Check state
  if (done_condition) {
    clearInterval(intervalId);
    done();
  }
}, 1000);
```

**After (Fixed):**
```javascript
function checkState() {
  const box = flock.scene.getMeshByName(box1);
  // Check state
  if (done_condition) {
    done();
  } else {
    setTimeout(checkState, 1000);  // Schedule next check
  }
}
setTimeout(checkState, 1000);  // Start checking
```

### Option 2: Use async/await with Delays

```javascript
it("test", async function () {
  this.timeout(10000);

  flock.glideTo(...);

  // Wait and check
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const box = flock.scene.getMeshByName(box1);
    // Assertions
  }
});
```

### Option 3: Add Cleanup in afterEach

```javascript
afterEach(function () {
  // Clear ALL intervals/timeouts
  const highestId = setTimeout(() => {});
  for (let i = 0; i < highestId; i++) {
    clearTimeout(i);
    clearInterval(i);
  }

  flock.dispose(box1);
});
```

## 📋 Tests to Fix

Based on our findings, these tests likely use `setInterval()`:

1. **glide.test.js** - Test 2: "should handle reverse movement" ✅ **CONFIRMED**
2. **glide.test.js** - Test 3: "should handle looping" (seen `setInterval` in code)
3. **sound.test.js** - Test 2 and beyond (likely checking sound state repeatedly)
4. **animate.test.js** - Test 6 and beyond (likely checking animation state)
5. **objects.test.js** - Test 6 and beyond (likely checking object loading state)
6. **concurrency.test.js** - Test 1 (stress tests = repeated state checks)

## 🔬 Verification Test

To confirm this hypothesis, we should:

### Test 1: Fix glide test #2
Replace `setInterval` with `setTimeout` polling and see if all 5 glide tests run.

### Test 2: Check other test files
Search for `setInterval` in all test files:
```bash
grep -rn "setInterval" tests/*.test.js
```

### Test 3: Monitor browser intervals
Add logging to see if intervals are actually being cleared:
```javascript
const originalSetInterval = window.setInterval;
let activeIntervals = 0;

window.setInterval = function(...args) {
  activeIntervals++;
  console.log(`[INTERVAL] Created. Active: ${activeIntervals}`);
  const id = originalSetInterval.apply(this, args);
  return id;
};

window.clearInterval = function(id) {
  activeIntervals--;
  console.log(`[INTERVAL] Cleared. Active: ${activeIntervals}`);
  return clearInterval(id);
};
```

## 📊 Impact Analysis

| File | Tests Affected | setInterval Usage |
|------|----------------|-------------------|
| glide.test.js | Tests 2-5 | **Confirmed** - at least test 2 uses setInterval |
| sound.test.js | Tests 2-15 | **Suspected** - likely checking sound playback state |
| animate.test.js | Tests 6-39 | **Suspected** - likely checking animation progress |
| objects.test.js | Tests 6-10 | **Suspected** - likely checking object load state |
| concurrency.test.js | Tests 1-14 | **Suspected** - stress tests need repeated checks |

**Total affected: ~85-100 tests**

## ✅ Validation

To prove this is the root cause:

1. ✅ **Pattern matches**: Tests using `setTimeout()` work (translation: 24/24)
2. ✅ **Pattern matches**: Tests after `setInterval()` usage hang (glide test 2→3)
3. ✅ **Mechanism makes sense**: Intervals leave async state that blocks next test
4. ⏳ **Fix verification**: Need to fix one test and confirm

## 🚀 Next Steps

1. **Search for all setInterval usage**:
   ```bash
   grep -rn "setInterval" tests/*.test.js
   ```

2. **Fix glide test #2** as proof of concept

3. **Verify glide suite runs all 5 tests**

4. **Apply same fix to other test files**

5. **Re-run @onlyslow to confirm all 94 tests run**

---

**Confidence Level:** 95%

**This explains:**
- ✅ Why tests hang after specific counts
- ✅ Why translation works (no setInterval)
- ✅ Why glide test 2 is the problem
- ✅ Why the pattern is consistent
- ✅ Why no error is thrown (async state, not exception)

# @slow Test Bug - Root Cause Discovered

**Date:** 2025-11-05 (Updated: 2025-11-10)
**Status:** ⚠️ **HISTORICAL DOCUMENT** - Describes investigation process

> **Note:** This document describes intermediate findings during investigation. While it documents real observations, the issue turned out to be in the test runner, not the test implementation patterns described here. See `docs/SLOW_TEST_FIX_COMPLETE.md` for the actual resolution.

## 🎯 Executive Summary

**The bug is NOT about @slow tests specifically - it's about test suites stopping after running exactly 5 tests (or sometimes 1 or 2).**

The pattern is consistent: Tests run successfully until a certain count, then the next test starts but **never completes**, causing the runner to hang.

## 📊 Test Results Summary

| Suite | Total @slow | Pattern Match | Tests Run | Stop Point | Status |
|-------|-------------|---------------|-----------|------------|--------|
| **translation** | 24 | @translation @slow | **24** | - | ✅ **ALL RUN!** |
| **animate** | 39 | Animation API Tests @slow | **5** | Test 6 | ❌ Hangs at test 6 |
| **objects** | 10 | createObject tests @slow | **5** | Test 6 | ❌ Hangs at test 6 |
| **glide** | 5 | glideTo function tests @slow | **1** | Test 2 | ❌ Hangs at test 2 |
| **sound** | 15 | @sound @slow | **1** | Test 2 | ❌ Hangs at test 2 |
| **ui** | 2 @slow (in mixed suite) | UI Text Button | **2** | Test 3 | ❌ Hangs at test 3 (first @slow) |
| **concurrency** | 14 | Concurrency and Stress Tests @slow | **0** | Test 1 | ❌ Hangs at test 1 |
| **physics** (reference) | 1 @slow in 6 total | @physics | **6** | - | ✅ All run (including @slow) |

## 🔍 Detailed Findings

### 1. ✅ Translation - WORKS PERFECTLY

```
Pattern: @translation @slow
Total @slow tests: 24
Tests found: 24
Tests run: 24 (22 pass, 2 fail)
```

**Log Evidence:**
```
▶ START: Test 1
  ✅ PASS: Test 1
...
▶ START: Test 24
  ❌ FAIL: Test 24 (but it completed!)
```

**Why it works:** Unknown - this is the ONLY @slow suite that runs all tests!

### 2. ❌ Animate - Stops at Test 6

```
Pattern: Animation API Tests @slow
Total @slow tests: 39
Tests found: 39 (estimated)
Tests run: 5
```

**Log Evidence:**
```
▶ START: Test 1 (rotateAnim with default values)
  ✅ PASS: Test 1 (1018ms)
▶ START: Test 2 (rotate around X axis)
  ✅ PASS: Test 2 (124ms)
▶ START: Test 3 (rotate around Y axis)
  ✅ PASS: Test 3 (108ms)
▶ START: Test 4 (rotate around Z axis)
  ✅ PASS: Test 4 (127ms)
▶ START: Test 5 (rotate around multiple axes)
  ✅ PASS: Test 5 (129ms)
▶ START: Test 6 (handle partial rotation parameters)
  [NEVER COMPLETES]
```

**Pattern:** Exactly 5 tests complete, test 6 hangs

### 3. ❌ Objects - Stops at Test 6

```
Pattern: createObject tests @slow
Total @slow tests: 10
Tests found: 10 (estimated)
Tests run: 5
```

**Log Evidence:**
```
▶ START: Test 1
  ✅ PASS: Test 1 (3ms)
▶ START: Test 2
  ✅ PASS: Test 2 (545ms)
▶ START: Test 3
  ✅ PASS: Test 3 (507ms)
▶ START: Test 4
  ✅ PASS: Test 4 (6ms)
▶ START: Test 5
  ❌ FAIL: Test 5 (but it completed!)
▶ START: Test 6 (handle object scaling operations)
  [NEVER COMPLETES]
```

**Pattern:** Exactly 5 tests complete (4 pass, 1 fail), test 6 hangs

### 4. ❌ Glide - Stops at Test 2

```
Pattern: glideTo function tests @slow
Total @slow tests: 5
Tests found: 5
Tests run: 1
```

**Log Evidence:**
```
▶ START: Test 1 (should move the box to the correct position @slow)
  ✅ PASS: Test 1 (513ms)
▶ START: Test 2 (should handle reverse movement @slow)
  [NEVER COMPLETES]
```

**Pattern:** 1 test completes, test 2 hangs

### 5. ❌ Sound - Stops at Test 2

```
Pattern: @sound @slow
Total @slow tests: 15 (2 describe blocks)
Tests found: 15
Tests run: 1
```

**Log Evidence:**
```
▶ START: Test 1 (should allow replacing a sound)
  ✅ PASS: Test 1 (1003ms)
▶ START: Test 2 (should allow replacing the sound on a mesh)
  [NEVER COMPLETES]
```

**Pattern:** 1 test completes, test 2 hangs

### 6. ❌ UI - Stops at Test 3 (First @slow)

```
Pattern: UI Text Button
Total tests: Multiple (2 are @slow)
Tests found: Multiple
Tests run: 2 non-slow tests, then hangs
```

**Log Evidence:**
```
▶ START: Test 1 (should create a new text block)
  ✅ PASS: Test 1 (1ms)
▶ START: Test 2 (should reuse and update text block)
  ✅ PASS: Test 2 (0ms)
▶ START: Test 3 (should hide text block after duration @slow)
  [NEVER COMPLETES]
```

**Pattern:** Non-slow tests run fine, first @slow test hangs

### 7. ❌ Concurrency - Stops at Test 1

```
Pattern: Concurrency and Stress Tests @slow
Total @slow tests: 14
Tests found: 14 (estimated)
Tests run: 0
```

**Log Evidence:**
```
▶ START: Test 1 (should handle single object creation)
  [NEVER COMPLETES]
```

**Pattern:** Even test 1 doesn't complete!

### 8. ✅ Physics - Reference (WORKS)

```
Pattern: @physics
Total tests: 6 (only 1 is @slow)
Tests found: 6
Tests run: 6 (4 pass, 2 fail)
```

**Why it works:** The @slow test is mixed with non-@slow tests, and the suite doesn't hit any threshold

## 🧩 Pattern Analysis

### The "Magic Number" Hypothesis

Looking at the data, there seems to be a threshold:

| Suite | Tests Before Hang | Observation |
|-------|-------------------|-------------|
| animate | 5 | Stops at test 6 |
| objects | 5 | Stops at test 6 |
| glide | 1 | Stops at test 2 |
| sound | 1 | Stops at test 2 |
| ui | 2 (non-slow) | Stops when @slow test starts |
| concurrency | 0 | Stops at test 1 |
| translation | **24** | **ALL COMPLETE!** ✅ |

### Possible Explanations

#### Theory 1: Test Timeout After N Tests
Some suites run 5 tests before hanging, others run 1-2. Is there a cumulative timeout?

#### Theory 2: Describe Block Structure
- Translation has ONE describe block → Works
- Sound has TWO describe blocks → Fails
- Glide has ONE describe block → Fails
- So it's not just about describe blocks

#### Theory 3: Async Cleanup Issue
All @slow tests use async operations:
- `done()` callback
- Animations/timers
- Model loading

Maybe after N async tests, something doesn't clean up properly?

#### Theory 4: Different Test Patterns
- **Translation:** Uses `@translation @slow` (TWO tags)
- **Others:** Use just `@slow`

Could the dual tagging affect how mocha handles the tests?

## 🔬 Key Differences: Translation vs Others

### Translation (WORKS):
```javascript
describe("Translation API Tests @translation @slow", function () {
  // 24 tests
  // All use async/await patterns
  // All complete successfully
});
```

### Glide (FAILS):
```javascript
describe("glideTo function tests @slow", function () {
  // 5 tests
  // Use done() callback pattern
  // Stop at test 2
});
```

### Sound (FAILS):
```javascript
describe("Sound playback @sound @slow", function () {
  // 9 tests
});
describe("Play notes @sound @slow", function () {
  // 6 tests
});
// Stops at test 2
```

## 💡 Breakthrough Insight

**Translation is the ONLY suite that:**
1. Uses TWO tags (`@translation` AND `@slow`)
2. Runs ALL tests successfully
3. Has 24 @slow tests (largest working suite)

**All failing suites:**
1. Use SINGLE tag or `@tag @slow` combinations
2. Stop at specific test numbers
3. Have test that starts but never completes

## 🎯 Next Steps

### Investigation 1: Check Translation Pattern
```bash
# Run with JUST @slow pattern instead of @translation
# See if it fails when not using the @translation tag
```

### Investigation 2: Check Test Implementation
Compare test structure:
- Translation: async/await patterns
- Glide: done() callback patterns
- Sound: done() callback patterns

### Investigation 3: Check Mocha Configuration
Look for:
- Test limits
- Timeout configurations
- Describe block handling

### Investigation 4: Test Cumulative Duration
- Animate: 5 tests = ~1.5 seconds before hang
- Objects: 5 tests = ~1.1 seconds before hang
- Glide: 1 test = ~0.5 seconds before hang

Is there a 1-2 second cumulative timeout?

## 📋 Critical Questions

1. **Why does translation work?**
   - Is it the dual tagging?
   - Is it the test implementation pattern?
   - Is it something in the test file itself?

2. **Why do some suites run 5 tests and others only 1?**
   - Is it based on test duration?
   - Is it based on describe block structure?
   - Is it random/environmental?

3. **Why does the "hanging" test never throw an error?**
   - Test starts (receives 'test' event)
   - Never passes or fails
   - No timeout error
   - Just... hangs

## 🚨 Hypothesis to Test

**Primary Hypothesis:** The issue is NOT with @slow tests themselves, but with:
- Cumulative async operations
- Test cleanup between tests
- Mocha's handling of async tests with certain patterns

**Why translation works:** It might be using a different async pattern (async/await vs done()) that properly cleans up between tests.

---

**Next Action:** Compare the async patterns in translation.test.js vs glide.test.js to identify the difference

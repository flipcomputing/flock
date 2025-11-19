# @slow Test Distribution Analysis

**Date:** 2025-11-05 (Updated: 2025-11-10)
**Status:** ⚠️ **HISTORICAL DOCUMENT** - Issue has been resolved
**Purpose:** Understand the distribution of @slow tests across test suites to debug the "only 1 test runs" issue

> **Note:** This document describes early investigation and analysis. The actual root cause was identified as a test runner issue in `scripts/run-api-tests.mjs`, not a test implementation issue. See `docs/SLOW_TEST_FIX_COMPLETE.md` for the final resolution.

## 📊 @slow Test Distribution

### Summary Table

| Test File | @slow Tests | Test Suite ID | Pattern | Notes |
|-----------|-------------|---------------|---------|-------|
| **sound.test.js** | **15** | sound | @sound | 2 describe blocks: "Sound playback @sound @slow" + "Play notes @sound @slow" |
| **animate.test.js** | **39** | animate | Animation API Tests | 1 describe block: "Animation API Tests @slow" |
| **transform.translate.test.js** | **24** | translation | @translation | 1 describe block: "Translation API Tests @translation @slow" + 1 individual test |
| **concurrency.test.js** | **14** | concurrency | Concurrency and Stress Tests | 1 describe block: "Concurrency and Stress Tests @slow" |
| **objects.test.js** | **10** | objects | createObject tests | 1 describe block: "createObject tests @slow" |
| **glide.test.js** | **5** | glide | glideTo function tests | 1 describe block: "glideTo function tests @slow" + 2 individual tests tagged |
| **uitextbutton.test.js** | **2** | ui | UI Text Button | 2 individual it() blocks tagged @slow |
| **physics.test.js** | **1** | physics | @physics | 1 individual it() block: "should apply force to a mesh with default values (no movement) @slow" |
| **boxes.test.js** | **1** | stress | Stress test for many boxes | 1 describe block: "Stress test for many boxes @slow" |

**Total @slow tests: ~111 tests**

### Test Structure Patterns

**Pattern 1: Entire describe block tagged @slow**
- All tests within the describe block are @slow
- Examples: sound.test.js, animate.test.js, translate.test.js

**Pattern 2: Individual it() blocks tagged @slow**
- Only specific tests are @slow
- Examples: uitextbutton.test.js, physics.test.js

**Pattern 3: Mixed (describe + individual tags)**
- Both describe block and individual tests tagged
- Example: glide.test.js

## 🔍 Detailed Breakdown

### 1. sound.test.js (15 @slow tests)

**Structure:**
```javascript
describe("Sound playback @sound @slow", function () {
  // ~9 tests
});

describe("Play notes @sound @slow", function () {
  // ~6 tests
});
```

**Tags:** Both `@sound` AND `@slow`
**Current Behavior:** Only 1 test runs when using `@sound` or `@slow` pattern
**Test Suite:** sound

### 2. animate.test.js (39 @slow tests)

**Structure:**
```javascript
describe("Animation API Tests @slow", function () {
  // 39 tests total
});
```

**Tags:** `@slow`
**Test Suite:** animate
**Note:** Largest @slow test collection

### 3. transform.translate.test.js (24 @slow tests)

**Structure:**
```javascript
describe("Translation API Tests @translation @slow", function () {
  // ~23 tests
  it("should move a box to the target box centre position without changing Y when useY is false @slow", ...)
  // 1 additional test tagged individually
});
```

**Tags:** Both `@translation` AND `@slow`
**Test Suite:** translation

### 4. concurrency.test.js (14 @slow tests)

**Structure:**
```javascript
describe("Concurrency and Stress Tests @slow", function () {
  // 14 tests
});
```

**Tags:** `@slow`
**Test Suite:** concurrency
**Note:** Stress tests

### 5. objects.test.js (10 @slow tests)

**Structure:**
```javascript
describe("createObject tests @slow", function () {
  // 10 tests
});
```

**Tags:** `@slow`
**Test Suite:** objects

### 6. glide.test.js (5 @slow tests)

**Structure:**
```javascript
describe("glideTo function tests @slow", function () {
  it("should move the box to the correct position @slow", ...)
  it("should handle reverse movement @slow", ...)
  // 3 more tests (not individually tagged)
});
```

**Tags:** `@slow` on describe + 2 individual it() tags
**Test Suite:** glide
**Known Issue:** Second test starts but never completes

### 7. uitextbutton.test.js (2 @slow tests)

**Structure:**
```javascript
describe("UI Text Button tests", function () {
  // ... other tests ...
  it("should hide the text block after the specified duration @slow", ...)
  it("should show the text block again using the show function @slow", ...)
});
```

**Tags:** Individual it() blocks tagged `@slow`
**Test Suite:** ui
**Note:** Mixed suite - some tests are @slow, others are not

### 8. physics.test.js (1 @slow test)

**Structure:**
```javascript
describe("applyForce method @physics", function () {
  // ... other tests ...
  it("should apply force to a mesh with default values (no movement) @slow", ...)
});
```

**Tags:** Individual it() block tagged `@slow` AND `@physics`
**Test Suite:** physics
**Note:** This test DOES run successfully when running physics suite

### 9. boxes.test.js (1 @slow test)

**Structure:**
```javascript
describe("Stress test for many boxes @slow", function () {
  // 1 test
});
```

**Tags:** `@slow`
**Test Suite:** stress
**Note:** Stress test

## 🎯 Testing Strategy

To debug the @slow issue, we should test:

### 1. Suite-Specific + @slow Pattern

Run each test suite with BOTH its specific pattern AND @slow tag:
```bash
npm run test:api glide -- --log-all --verbose
# vs
# Custom run with pattern: "glideTo function tests @slow"
```

### 2. Individual Suite Tests

Test suites that mix @slow and non-@slow tests:
- **physics**: Has both @physics tests (5 non-slow) and 1 @slow test
- **ui**: Has non-slow tests and 2 @slow tests
- **translation**: Has @translation @slow tests

### 3. Pure @slow Suites

Test suites that are entirely @slow:
- **animate**: All 39 tests are @slow
- **concurrency**: All 14 tests are @slow
- **objects**: All 10 tests are @slow

## 🔬 Hypotheses to Test

### Hypothesis 1: Describe-level tagging issue
If a describe block is tagged @slow, maybe only the first test runs?

**Test:** Run animate suite (entire describe block tagged)

### Hypothesis 2: Multiple describe blocks issue
sound.test.js has TWO describe blocks, both tagged @slow

**Test:** Run sound suite and check if it switches between describe blocks

### Hypothesis 3: Async/timing in @slow tests
@slow tests use done() callback or async - maybe cleanup issue?

**Test:** Compare physics (1 @slow test that works) vs glide (first works, second hangs)

### Hypothesis 4: Test duration matters
@slow tests take >500ms - maybe there's a timeout or race condition?

**Test:** Check if reducing test duration helps

## 📋 Test Plan

### Phase 1: Run Individual Suites with Logging

```bash
# 1. Glide (known issue - 5 tests, only 1 runs)
npm run test:api glide -- --log-all --verbose

# 2. Sound (15 tests, only 1 runs)
npm run test:api sound -- --log-all --verbose

# 3. Animate (39 tests - largest @slow suite)
npm run test:api animate -- --log-all --verbose

# 4. Translation (24 tests)
npm run test:api translation -- --log-all --verbose

# 5. Physics (6 total, 1 is @slow - THIS WORKS!)
npm run test:api physics -- --log-all --verbose

# 6. UI (mixed - some @slow, some not)
npm run test:api ui -- --log-all --verbose

# 7. Objects (10 @slow tests)
npm run test:api objects -- --log-all --verbose

# 8. Concurrency (14 @slow tests)
npm run test:api concurrency -- --log-all --verbose
```

### Phase 2: Analyze Patterns

After running all tests, look for:
- Does the first test always complete?
- Does the second test always start but not complete?
- Are there any suites where multiple @slow tests run?
- Is there a pattern in which tests succeed vs hang?

### Phase 3: Compare Working vs Broken

**Working Example: physics @slow test**
- Only 1 @slow test in the suite
- Runs successfully
- Compare implementation to broken tests

**Broken Example: glide @slow tests**
- Multiple @slow tests in suite
- Only first completes
- Second starts but hangs

## 🎓 Expected Insights

By running each suite individually, we should learn:

1. **Is it specific to @onlyslow?** Or does each suite exhibit the problem?
2. **Does suite size matter?** Do larger @slow suites (animate: 39) behave differently than smaller ones (glide: 5)?
3. **Does tagging pattern matter?** Describe-level vs it-level tagging
4. **What about mixed suites?** ui and physics have both @slow and non-slow tests
5. **Is there a common pattern in test implementation?** All broken tests use done() callback?

## 📊 Current Known Behavior

From previous testing:

| Suite | @slow Tests | Tests Found | Tests Run | Status |
|-------|-------------|-------------|-----------|--------|
| @onlyslow | ~111 | 94 | 1 | ❌ Only first runs |
| glide | 5 | 5 | 1 | ❌ Second starts, never finishes |
| sound | 15 | 15 | 1 | ❌ Second starts, never finishes |
| physics | 6 total (1 @slow) | 6 | 6 | ✅ All run (including @slow one) |

**Key Question:** Why does physics @slow test work but glide/sound @slow tests don't?

---

**Next Step:** Run each test suite individually with logging to gather data

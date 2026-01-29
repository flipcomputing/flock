# API Documentation & Testing Quality Tools

**Purpose:** Tools and workflows to improve and maintain quality of the Flock XR API documentation and test coverage.

**Status:** ✅ Operational - All tools working

## Overview

This project provides automated tooling to track and improve API quality across two dimensions:

1. **Documentation Coverage** - Are API methods documented (API.md + JSDoc)?
2. **Test Coverage** - Are API methods tested?

## Quick Start

```bash
# Check current API quality metrics
npm run docs:coverage

# Run all tests
npm run test:api @notslow

# Run specific test suite
npm run test:api babylon

# Run with detailed logging
npm run test:api glide -- --log-all --verbose
```

## The Scripts

### 1. API Coverage Report (`scripts/api-coverage-report.mjs`)

**What it does:**
- Analyzes all 108 API methods in `flock.js`
- Tracks documentation from two sources: API.md and JSDoc
- Maps test coverage for each method
- Generates detailed markdown report

**Usage:**
```bash
npm run docs:coverage
```

**Output:**
```
📊 Total API Methods: 108
📖 API.md Documentation: 52 methods

Summary Statistics:
  ✅ Documented:       52 (48%)
     ├─ API.md only:   52 methods
     ├─ JSDoc only:    0 methods
     └─ Both:          0 methods
  ✅ Tested:           53 (49%)
  ❌ Undocumented:     56 (52%)
  ❌ Untested:         55 (51%)

Coverage by Category:
  ✅ Animation:    11 methods (55% documented, 100% tested)
  ❌ Mesh:         8 methods (0% documented, 0% tested)
```

**Generates:** `reports/api-coverage.md` with detailed breakdown

### 2. CLI Test Runner (`scripts/run-api-tests.mjs`)

**What it does:**
- Starts Vite dev server automatically
- Launches headless Playwright browser
- Runs mocha tests via automation
- Reports results with proper exit codes

**Usage:**
```bash
# Run specific suite
npm run test:api babylon

# Run all fast tests (100 tests)
npm run test:api @notslow

# Run all slow tests (94 tests)
npm run test:api @onlyslow

# With API call logging
npm run test:api glide -- --log-api

# With test execution logging
npm run test:api glide -- --log-tests

# With both logs
npm run test:api glide -- --log-all --verbose
```

**Available suites:**
- `babylon` (3 tests) - Basic API tests
- `materials` (22 tests) - Material system
- `physics` (6 tests) - Physics engine
- `scale` (45 tests) - Scaling operations
- `glide` (5 tests) - Animation gliding
- `sound` (15 tests) - Audio playback
- `@notslow` (100 tests) - All fast tests
- `@onlyslow` (94 tests) - All slow tests

**Logging Options:**
- `--log-api` - Logs all API method calls with timestamps
- `--log-tests` - Logs test execution lifecycle (start/pass/fail)
- `--log-all` - Both API and test logging
- `--verbose` - Additional diagnostic output

**Log Files:**
- `logs/api-calls.log` - API method calls and frequency
- `logs/test-execution.log` - Test lifecycle events

### 3. Utility Scripts (`scripts/utils/`)

These are used by the main tools but can be run independently:

#### `extract-api-methods.mjs`
Extracts all API methods from `flock.js` (lines 865-987)
```bash
node scripts/utils/extract-api-methods.mjs
```

#### `parse-jsdoc.mjs`
Parses JSDoc comments from `api/*.js` files
```bash
node scripts/utils/parse-jsdoc.mjs
```

#### `parse-api-md.mjs`
Parses documented methods from `API.md`
```bash
node scripts/utils/parse-api-md.mjs
```

#### `test-analyzer.mjs`
Analyzes which methods have test coverage
```bash
node scripts/utils/test-analyzer.mjs
```

## Workflow: Improving API Quality

### Adding Documentation

#### Option 1: Add to API.md (User-Facing)
1. Run coverage report to identify undocumented methods:
   ```bash
   npm run docs:coverage
   ```
2. Open `API.md` and add method documentation following existing pattern:
   ```markdown
   #### `methodName(param1, param2)`

   Description of what the method does.

   **Parameters:**
   - `param1` (type) - Description

   **Returns:** Description

   **Example:**
   ```javascript
   flock.methodName("value", options);
   ```
   ```
3. Re-run coverage to verify:
   ```bash
   npm run docs:coverage
   ```

#### Option 2: Add JSDoc (Developer-Facing)
1. Find method implementation in `api/*.js`
2. Add JSDoc comment above method:
   ```javascript
   /**
    * Creates a 3D box in the scene
    *
    * @category Shapes
    * @param {string} boxId - Unique identifier for the box
    * @param {Object} [options] - Configuration options
    * @param {number} [options.width=1] - Width of the box
    * @param {number} [options.height=1] - Height of the box
    * @param {string} [options.color="#9932CC"] - Hex color value
    * @returns {string} The name/ID of the created box mesh
    *
    * @example
    * const box = createBox("myBox", {
    *   width: 2,
    *   height: 2,
    *   color: "#ff0000"
    * });
    */
   createBox(boxId, options = {}) {
     // implementation
   }
   ```
3. Re-run coverage to verify:
   ```bash
   npm run docs:coverage
   ```

**Best Practice:** Document methods in BOTH places:
- API.md for users learning the API
- JSDoc for developers and IDE autocomplete

### Adding Tests

1. Run coverage report to identify untested methods:
   ```bash
   npm run docs:coverage
   ```

2. Check the **Untested Methods** section and **Coverage by Category**:
   ```
   ❌ Mesh operations: 8 methods (0% tested)
     - parentChild
     - hold
     - attach
     - drop
     ...
   ```

3. Create or update appropriate test file in `tests/`:
   - `tests/mesh.test.js` - Mesh operations
   - `tests/camera.test.js` - Camera methods
   - `tests/materials.test.js` - Material methods
   - etc.

4. Follow existing test patterns:
   ```javascript
   describe("Mesh operations @mesh", function () {
     let testMesh;

     beforeEach(function () {
       testMesh = flock.createBox("testBox");
     });

     afterEach(function () {
       flock.dispose(testMesh);
     });

     it("should attach mesh to parent", function (done) {
       const parent = flock.createBox("parent");
       flock.attach(testMesh, parent);

       setTimeout(() => {
         // Assertions
         expect(flock.scene.getMeshByName(testMesh).parent).to.exist;
         flock.dispose(parent);
         done();
       }, 100);
     });
   });
   ```

5. Run your new tests:
   ```bash
   npm run test:api mesh
   ```

6. Re-run coverage to verify:
   ```bash
   npm run docs:coverage
   ```

## Current Status

**As of November 2025:**

```
Total API Methods:        108
Documented (API.md):      52 (48%)
Documented (JSDoc):       0 (0%)
Tested:                   53 (49%)
Total Tests:              226 tests
Test Files:               15 files
```

**Well-Covered Categories:**
- ✅ Animation: 100% tested, 55% documented
- ✅ Transform: 100% tested, 44% documented
- ✅ CSG Operations: 100% tested

**Priority Areas for Improvement:**
- ❌ Mesh operations: 0% tested, 0% documented
- ❌ Camera: 0% tested, 100% documented (needs tests!)
- ❌ Movement: 0% tested, 0% documented
- ❌ Shapes: 0% tested, 0% documented

## Integration with Development Workflow

### Daily Development
```bash
# Before committing changes
npm run docs:coverage      # Check if new methods need docs
npm run test:api @notslow  # Run fast tests
```

### Pre-commit Hook (Recommended)
Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
npm run test:api @notslow
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

### CI/CD Pipeline
```yaml
# Example GitHub Actions
- name: Run API Tests
  run: npm run test:api @notslow

- name: Generate Coverage Report
  run: npm run docs:coverage

- name: Upload Coverage Report
  uses: actions/upload-artifact@v2
  with:
    name: api-coverage
    path: reports/api-coverage.md
```

## Understanding the Reports

### Coverage Report Sections

**1. Summary Statistics**
Shows overall health of the API

**2. Undocumented Methods**
Lists methods with no documentation in either API.md or JSDoc
- Priority: Add at least API.md documentation

**3. Untested Methods**
Lists methods with no test coverage
- Priority: Write tests for these methods

**4. Coverage by Category**
Breaks down by functional area:
- Animation, Transform, Mesh, Camera, Physics, UI, etc.
- Shows both documentation and test coverage per category
- Helps identify which areas need attention

**5. Most Tested Methods**
Shows which methods have the most test coverage
- Good examples for writing new tests
- Indicates heavily-used API methods

## Troubleshooting

### Tests Not Running
```bash
# Check if dev server is already running
lsof -ti:5173 | xargs kill -9

# Re-run tests
npm run test:api babylon
```

### Coverage Report Shows 0%
- Check that methods are properly exposed in `flock.js` (lines 865-987)
- Verify API.md uses pattern: `#### \`methodName(params)\``
- Verify JSDoc comments are above method definitions

### Logging Not Working
```bash
# Ensure logs directory exists
mkdir -p logs

# Run with logging
npm run test:api glide -- --log-all --verbose

# Check log files
cat logs/test-execution.log
cat logs/api-calls.log
```

## Technical Architecture

### How It Works

1. **extract-api-methods.mjs**
   - Parses `flock.js` lines 865-987
   - Uses regex to find all `this.methodName = ...` assignments
   - Returns array of {name, line, implementation}

2. **parse-api-md.mjs**
   - Reads `API.md`
   - Searches for pattern: `#### \`methodName(`
   - Returns Set of documented method names

3. **parse-jsdoc.mjs**
   - Reads all `api/*.js` files
   - Parses JSDoc comments
   - Validates completeness (params, returns, examples)
   - Returns Map of method → JSDoc data

4. **test-analyzer.mjs**
   - Reads all `tests/*.test.js` files
   - Searches for `flock.methodName()` calls
   - Maps methods → test files that call them
   - Returns Map and statistics

5. **api-coverage-report.mjs**
   - Orchestrates all utility scripts
   - Combines data from all sources
   - Generates console output
   - Generates markdown report

6. **run-api-tests.mjs**
   - Starts Vite dev server (port 5173)
   - Launches Playwright headless browser
   - Navigates to `tests/tests.html`
   - Waits for Flock initialization
   - Selects test suite from dropdown
   - Clicks "Run Tests" button
   - Waits for all tests to complete
   - Collects results from mocha stats
   - Provides exit code (0 = pass, 1 = fail)

### Key Files

**API Definition:**
- `flock.js` (lines 865-987) - All API method bindings

**API Implementation:**
- `api/*.js` - Individual API module implementations

**Tests:**
- `tests/*.test.js` - Mocha test suites
- `tests/tests.html` - Test runner UI

**Documentation:**
- `API.md` - User-facing documentation

**Reports:**
- `reports/api-coverage.md` - Generated coverage report

## Future Enhancements

**Potential Additions:**
- [ ] Auto-generate API documentation site from JSDoc
- [ ] Coverage badges in README
- [ ] Test coverage thresholds in CI/CD
- [ ] Watch mode for test runner
- [ ] Performance benchmarks for API methods
- [ ] Auto-generate changelog from API changes

---

**For detailed getting started guide, see:** `docs/GETTING_STARTED.md`

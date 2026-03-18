# Getting Started with API Documentation & Testing

**Quick Start Guide for Flock XR API Quality Tools**

## What's Been Set Up

We've created a comprehensive tooling system to help you:
1. **Track API documentation coverage** - Know which methods lack documentation
2. **Track test coverage** - Know which methods lack tests
3. **Identify gaps** - Easily see what needs work
4. **Measure progress** - Track improvements over time

## Try It Now!

### Step 1: Run the Coverage Report

```bash
npm run docs:coverage
```

You'll see a comprehensive report showing:
- Total API methods: **108**
- Currently tested: **49%** (53/108 methods)
- Currently documented: **48%** (52/108 methods in API.md)
- Breakdown by category (Animation, Physics, UI, etc.)

The report also creates a detailed markdown file at `reports/api-coverage.md` that you can reference.

### Step 2: Review the Reports

Open these files to understand your API's current state:

1. **`reports/api-coverage.md`** - Detailed coverage analysis
2. **`docs/API_RECONCILIATION_PLAN.md`** - The complete strategy
3. **`docs/IMPLEMENTATION_STATUS.md`** - What's done and what's next
4. **`docs/DOCUMENTATION_TRACKING_UPDATE.md`** - How we track documentation

### Step 3: Run Tests via CLI

The CLI test runner is fully operational:

```bash
# Run all tests
npm run test:api babylon

# Run specific test suite
npm run test:api glide

# Run all @slow tests
npm run test:api @onlyslow

# Run with detailed logging
npm run test:api glide -- --log-all --verbose
```

**Or use the web UI:**
```bash
# Terminal: Start dev server
npm run dev

# Browser: Open
# http://localhost:5173/tests/tests.html
```

Select a test suite from the dropdown and click "Run Tests".

## What the Coverage Report Shows

### Example Output:

```
╔════════════════════════════════════════╗
║  API Documentation & Test Coverage    ║
╚════════════════════════════════════════╝

📊 Total API Methods: 108
📖 API.md Documentation: 53 methods

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
  ✅ Transform:    9 methods (44% documented, 100% tested)
  ❌ Mesh:         8 methods (0% documented, 0% tested)
  ❌ Camera:       3 methods (100% documented, 0% tested)
```

## Understanding Documentation Types

The coverage tool tracks **two types of documentation**:

### 1. API.md Documentation (User-Facing)
- Located in `API.md`
- High-level descriptions and examples
- For end users and developers learning the API
- Currently: **52 methods documented** (48%)

### 2. JSDoc Documentation (Developer-Facing)
- Inline comments in source code (`api/*.js`)
- Technical parameter types, return values
- For IDE autocomplete and API reference
- Currently: **0 methods documented** (0%)

**Ideal State:** Methods documented in **BOTH** places
- API.md for usage examples and concepts
- JSDoc for technical details and types

## Next Steps - Choose Your Path

### Path A: Add JSDoc to Source Code

Add JSDoc to API implementation files to improve developer experience.

**Example JSDoc Template:**
```javascript
/**
 * Creates a 3D box in the scene
 *
 * @category Shapes
 * @param {string} boxId - Unique identifier for the box
 * @param {Object} [options] - Configuration options
 * @param {number} [options.width=1] - Width of the box
 * @param {number} [options.height=1] - Height of the box
 * @param {number} [options.depth=1] - Depth of the box
 * @param {string} [options.color="#9932CC"] - Hex color value
 * @param {Array<number>} [options.position=[0,0,0]] - [x, y, z] position
 * @returns {string} The name/ID of the created box mesh
 *
 * @example
 * const box = createBox("myBox", {
 *   width: 2,
 *   height: 2,
 *   color: "#ff0000",
 *   position: [0, 1, 0]
 * });
 */
createBox(boxId, options = {}) {
  // implementation...
}
```

**Where to add JSDoc:**
- `api/animate.js` - Animation methods (6/11 need JSDoc)
- `api/shapes.js` - Shape creation methods
- `api/mesh.js` - Mesh operations (0/8 have JSDoc)
- `api/camera.js` - Camera controls
- etc.

**After adding JSDoc:**
```bash
npm run docs:coverage  # See your progress!
```

### Path B: Expand API.md Documentation

Add more methods to `API.md` for user-facing documentation.

**Currently undocumented methods that need API.md entries:**
- Mesh operations (8 methods): `parentChild`, `hold`, `attach`, `drop`, etc.
- CSG operations (4 methods): `mergeMeshes`, `subtractMeshes`, etc.
- Advanced animation (5 methods): `createAnimation`, `animateFrom`, etc.

**After updating API.md:**
```bash
npm run docs:coverage  # See improvement!
```

### Path C: Focus on Testing

Write tests for untested methods to improve test coverage.

**Priority Areas (0% tested):**
1. **Mesh operations** (8 methods) - parentChild, hold, attach, drop, etc.
2. **Camera** (3 methods) - getCamera, cameraControl, attachCamera
3. **Movement** (3 methods) - moveForward, moveSideways, strafe
4. **Shapes** (4 methods) - createCylinder, createCapsule, createPlane, create3DText

**After adding tests:**
```bash
npm run test:api <suite-name>  # Run your new tests
npm run docs:coverage           # See coverage improvement
```

## Understanding Your API

### By the Numbers

- **108 total methods** exposed in `flock.js`
- **14 API modules** in `./api` folder
- **15 test files** with 226 total tests
- **18 test suites** defined
- **52 methods** documented in API.md (48%)
- **0 methods** with JSDoc (0%)

### Documentation Status by Category

```
✅ Camera:       3/3 documented (100%) - All in API.md
⚠️  Animation:   6/11 documented (55%) - All in API.md
⚠️  Materials:   7/11 documented (64%) - All in API.md
❌ Mesh:         0/8 documented (0%) - Need API.md + JSDoc
❌ CSG Ops:      0/4 documented (0%) - Need API.md + JSDoc
```

### Top Priority Methods to Document/Test

**Most Used (Heavily Tested):**
- `createBox` - 11 test files use it (✅ documented in API.md)
- `dispose` - 11 test files use it (❌ not documented)
- `glideTo` - 4 test files use it (✅ documented in API.md)
- `show` / `hide` - 4 test files each (❌ not documented)

**Never Tested (Need Tests):**
- All Mesh operations (parentChild, hold, attach, etc.)
- All Camera operations (documented but untested!)
- All Movement operations
- All Shape creation (Cylinder, Capsule, Plane)

### Test Coverage Winners 🏆

- **Animation**: 100% tested (11/11 methods)
- **Transform**: 100% tested (9/9 methods)
- **CSG Operations**: 100% tested (4/4 methods)

### Test Coverage Gaps ❌

- **Mesh**: 0% tested (0/8 methods)
- **Camera**: 0% tested (0/3 methods)
- **Movement**: 0% tested (0/3 methods)
- **Shapes**: 0% tested (0/4 methods)

## Workflow Recommendations

### Daily Workflow
```bash
# Morning: Check current state
npm run docs:coverage

# During dev: Add JSDoc as you work on methods
# (Use template above in api/*.js files)

# During dev: Update API.md for new methods
# (Add user-facing examples and descriptions)

# During dev: Write tests for new features
# (Add to appropriate tests/*.test.js file)

# End of day: Check progress
npm run docs:coverage

# Run tests to verify changes
npm run test:api <suite-name>
```

### Weekly Goals

**Week 1:**
- Add JSDoc to 20 most-used methods (aim for 20% JSDoc coverage)
- Update API.md for `dispose`, `show`, `hide` (aim for 55% API.md coverage)
- Write tests for Mesh operations (8 methods)
- Target: 60% test coverage

**Week 2:**
- Complete JSDoc for all Animation methods (aim for 30% JSDoc coverage)
- Write tests for Camera and Movement
- Target: 75% test coverage

**Week 3:**
- Complete JSDoc for all Transform methods (aim for 40% JSDoc coverage)
- Write tests for Shapes
- Target: 85% test coverage

**Week 4:**
- Complete remaining JSDoc (aim for 80%+ JSDoc coverage)
- Fill in missing API.md documentation (aim for 80%+ API.md coverage)
- Target: 95% test coverage, 80%+ documented in both places

## Scripts Reference

```bash
# Documentation & Coverage
npm run docs:coverage          # Generate coverage report

# Testing
npm run test:api               # Run all tests
npm run test:api babylon       # Run specific suite
npm run test:api @onlyslow     # Run all @slow tests
npm run test:api glide -- --log-all --verbose  # With detailed logging

# Development
npm run dev                    # Start dev server for manual testing
```

## Files to Know

**Created for You:**
- `scripts/api-coverage-report.mjs` - Main coverage tool (✅ working)
- `scripts/run-api-tests.mjs` - CLI test runner (✅ working)
- `scripts/utils/*.mjs` - Helper utilities (✅ all working)
  - `extract-api-methods.mjs` - Extracts methods from flock.js
  - `parse-jsdoc.mjs` - Parses JSDoc from source files
  - `parse-api-md.mjs` - Parses API.md documentation
  - `test-analyzer.mjs` - Analyzes test coverage
- `reports/api-coverage.md` - Latest coverage report
- `docs/*.md` - Strategy and status docs

**Your Existing Files:**
- `API.md` - User-facing documentation (52 methods documented)
- `flock.js` (lines 865-987) - API bindings
- `api/*.js` - API implementations (where JSDoc should be added)
- `tests/*.test.js` - Test files

## Common Questions

**Q: Why does documentation show 48% instead of 0%?**
A: The tool now tracks documentation in **both** API.md and JSDoc comments. Currently, 52 methods are documented in API.md (48%), but 0 have JSDoc in source files. The ideal is to have both!

**Q: What's the difference between API.md and JSDoc?**
A:
- **API.md**: User-facing, conceptual, with examples (for learning)
- **JSDoc**: Technical, type information, parameters (for IDE autocomplete)

**Q: Should I add documentation to API.md or JSDoc first?**
A: Both are valuable! API.md is great for user-facing docs, JSDoc helps developers and enables IDE features. If you can only do one, start with JSDoc since it's in the source code where developers work.

**Q: How does the tool detect tests?**
A: It scans all `*.test.js` files for calls to `flock.methodName()` and maps them to API methods.

**Q: Can I run specific test suites?**
A: Yes! Use `npm run test:api <suite-name>`. Available suites include: babylon, animate, glide, sound, translation, objects, physics, stress, ui, @onlyslow.

**Q: How do I add a new test?**
A: Add test code to the appropriate `tests/*.test.js` file, following the existing pattern. The coverage tool will automatically detect it on the next run.

**Q: What if I add a new API method?**
A:
1. Add implementation to appropriate `api/*.js` file with JSDoc
2. Add binding to `flock.js`  in the `api` below `Flock API methods` (currently lines 865-987)
3. Add documentation to `API.md`
4. Write tests in appropriate `tests/*.test.js` file
5. Run `npm run docs:coverage` to verify it's tracked

**Q: Where can I see detailed test results?**
A: Run tests with `--log-all` flag. Logs are saved to:
- `logs/test-execution.log` - Test lifecycle events
- `logs/api-calls.log` - API method call tracking

## Get Help

- Check `scripts/README.md` for script details
- Check `docs/API_RECONCILIATION_PLAN.md` for strategy
- Check `docs/IMPLEMENTATION_STATUS.md` for current status
- Check `docs/DOCUMENTATION_TRACKING_UPDATE.md` for doc tracking details
- Check `docs/SLOW_TEST_FIX_COMPLETE.md` for test runner fix details
- Run `npm run docs:coverage` to see current metrics

## Recent Updates

**2025-11-05:**
- ✅ CLI test runner fully operational (94 @slow tests running)
- ✅ Documentation tracking now includes API.md (shows 48% documented)
- ✅ Coverage report shows breakdown: API.md vs JSDoc vs both
- ✅ Test logging infrastructure complete

---

**Ready to improve your API documentation and testing?**

Start with: `npm run docs:coverage`

Then pick your path:
1. **Add JSDoc** to source files for technical documentation
2. **Expand API.md** for user-facing documentation
3. **Write tests** for untested methods

All tools are working and ready to help you track progress!

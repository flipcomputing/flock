# API Documentation and Test Coverage Reconciliation Plan

**Project:** Flock XR
**Date:** 2025-01-04
**Status:** Proposed

## Executive Summary

This document outlines a comprehensive plan to reconcile API documentation across multiple sources (API.md, flock.js bindings, ./api implementation files) and establish systematic test coverage tracking. The goal is to create a maintainable, automated approach that scales with the development team.

## Current State

### API Sources

1. **API.md** (~537 lines)
   - User-facing markdown documentation
   - Documents ~60 API methods
   - Well-structured with examples
   - Manual maintenance required

2. **flock.js** (lines 865-987)
   - Runtime API binding layer
   - Exposes 123 methods to user code
   - Single source of truth for callable methods
   - Includes undocumented methods

3. **./api folder** (14 files)
   - Modular implementation organized by domain
   - Files: animate.js, camera.js, csg.js, effects.js, material.js, mesh.js, models.js, movement.js, physics.js, scene.js, shapes.js, sound.js, transform.js, ui.js
   - Exports grouped objects (e.g., `flockAnimate`, `flockCamera`)

4. **tests/** folder
   - 15+ test suites with 200+ individual tests
   - Tests organized in tests.html with manual test definitions array
   - Some API methods lack test coverage
   - Currently requires manual web server + browser interaction

### Key Issues

- **Documentation drift:** API.md documents 60 methods, but 123 are exposed
- **Missing docs:** Methods like `speak`, `playNotes`, `setBPM`, `createInstrument`, `cloneMesh`, `parentChild` exist but undocumented
- **No coverage tracking:** No systematic way to identify untested methods
- **Manual test execution:** Tests require running web server and clicking UI
- **Sync burden:** Changes require manual updates across multiple files

## Recommended Approach

### Phase 1: Tooling & Automation (Weeks 1-2)

#### 1.1 Coverage Analysis Scripts

**Script:** `scripts/api-coverage-report.js`
- Extracts all methods from flock.js (lines 865-987)
- Parses JSDoc from ./api files
- Cross-references with test files
- Generates comprehensive coverage report

**Output:**
```
API Documentation & Test Coverage Report
========================================

Total API Methods: 123
Documented: 60 (49%)
Tested: 90 (73%)

Undocumented Methods:
❌ speak (api/sound.js) - No JSDoc
❌ playNotes (api/sound.js) - No JSDoc
❌ setBPM (api/sound.js) - No JSDoc
...

Untested Methods:
❌ createInstrument (api/sound.js)
❌ cloneMesh (api/mesh.js)
...

Coverage by Category:
✅ Animation: 18/18 (100% documented, 100% tested)
✅ Shapes: 5/5 (100% documented, 100% tested)
⚠️  Sound: 1/4 (25% documented, 25% tested)
⚠️  Mesh: 12/15 (80% documented, 80% tested)
```

**Script:** `scripts/test-coverage-matrix.js`
- Creates a matrix showing which test files cover which API methods
- Identifies methods tested in multiple places
- Identifies methods with no tests

**Output:** Markdown table for documentation

#### 1.2 CLI Test Runner

**Script:** `scripts/run-api-tests.mjs`
- Uses Playwright to run tests headlessly
- Starts web server automatically
- Runs mocha tests programmatically
- Reports results in CLI-friendly format
- Supports filtering (all, suite name, tags)
- Returns proper exit codes for CI/CD

**Usage:**
```bash
npm run test:api              # Run all tests
npm run test:api:animate      # Run animation tests
npm run test:api:tag @new     # Run tests tagged @new
```

#### 1.3 Documentation Generator

**Script:** `scripts/generate-api-docs.js`
- Extracts JSDoc from ./api files
- Merges with existing API.md structure
- Generates updated API.md
- Creates warnings for missing/incomplete docs
- Preserves custom formatting and examples

**Script:** `scripts/validate-api-docs.js`
- Validates all exposed methods have JSDoc
- Checks JSDoc completeness (params, returns, examples)
- Fails if critical documentation is missing
- Can run in CI/CD pipeline

### Phase 2: Documentation Standards (Weeks 3-4)

#### 2.1 JSDoc Standard

Adopt JSDoc as the single source of truth for API documentation.

**Template:**
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
 * @param {Vector3|Array<number>} [options.position=[0,0,0]] - Position as Vector3 or [x, y, z]
 * @param {number} [options.alpha=1] - Transparency (0=transparent, 1=opaque)
 * @returns {string} The name/ID of the created box mesh
 *
 * @example
 * // Create a red box
 * const box1 = createBox("myBox", {
 *   width: 2, height: 2, depth: 2,
 *   color: "#ff0000",
 *   position: [0, 1, 0]
 * });
 *
 * @example
 * // Create a semi-transparent blue box
 * const box2 = createBox("glassBox", {
 *   color: "#0000ff",
 *   alpha: 0.5
 * });
 *
 * @tested boxes.test.js, animate.test.js
 * @see {@link https://docs.babylonjs.com/features/featuresDeepDive/mesh/creation/set/box|Babylon.js Box Docs}
 */
createBox(boxId, options = {}) {
  // implementation
}
```

**Required Fields:**
- `@category` - For organization (Animation, Shapes, Physics, etc.)
- `@param` - All parameters with types and descriptions
- `@returns` - Return value with type
- `@example` - At least one working example
- `@tested` - Reference to test file(s)

**Optional Fields:**
- `@see` - Links to related docs
- `@deprecated` - If method is being phased out
- `@since` - Version when method was added

#### 2.2 Documentation Workflow

1. **New API method:** Write JSDoc before implementation
2. **Code review:** Verify JSDoc completeness
3. **Pre-commit hook:** Validate JSDoc with `validate-api-docs.js`
4. **CI/CD:** Fail build if validation fails
5. **Auto-generate:** Update API.md from JSDoc nightly/on release

### Phase 3: Test Coverage Improvement (Weeks 5-8)

#### 3.1 Test Stub Generator

**Script:** `scripts/generate-test-stubs.js`
- Identifies untested methods from coverage report
- Generates test file with boilerplate structure
- Creates skipped tests as placeholders
- Team fills in implementation details

**Generated Output:**
```javascript
// tests/sound.test.js (auto-generated stub)
import { expect } from "chai";

export function runSoundTests(flock) {
  describe("Sound API Methods @sound", function() {

    describe("playNotes function", function() {
      it("should exist and be callable", function() {
        expect(typeof flock.playNotes).to.equal("function");
      });

      it.skip("should play notes with valid parameters", function() {
        // TODO: Implement test
        // Example usage:
        // await flock.playNotes({
        //   notes: ["C4", "E4", "G4"],
        //   duration: 0.5
        // });
      });

      it.skip("should handle invalid parameters gracefully", function() {
        // TODO: Test error handling
      });
    });

    describe("setBPM function", function() {
      it("should exist and be callable", function() {
        expect(typeof flock.setBPM).to.equal("function");
      });

      it.skip("should set beats per minute", function() {
        // TODO: Implement test
      });
    });
  });
}
```

#### 3.2 Coverage Targets

- **Q1 Target:** 80% test coverage (98/123 methods)
- **Q2 Target:** 90% test coverage (111/123 methods)
- **Q3 Target:** 95% test coverage (117/123 methods)

**Priority Order:**
1. High-usage methods (createBox, createCharacter, glideTo, etc.)
2. Core functionality (animation, physics, transforms)
3. Edge cases and error handling
4. Advanced/specialized methods

### Phase 4: CI/CD Integration (Week 9)

#### 4.1 GitHub Actions Workflow

```yaml
# .github/workflows/api-quality.yml
name: API Documentation & Test Quality

on: [pull_request, push]

jobs:
  api-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Validate API Documentation
        run: npm run validate:api-docs

      - name: Run API Tests
        run: npm run test:api

      - name: Generate Coverage Report
        run: npm run docs:coverage

      - name: Upload Coverage Report
        uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: reports/api-coverage.md

      - name: Comment Coverage on PR
        uses: actions/github-script@v6
        with:
          script: |
            // Post coverage summary as PR comment
```

#### 4.2 Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run validate:api-docs || {
  echo "❌ API documentation validation failed"
  echo "Run 'npm run validate:api-docs' to see details"
  exit 1
}
```

### Phase 5: Continuous Improvement (Ongoing)

#### 5.1 Metrics Dashboard

Create a simple HTML dashboard showing:
- Documentation coverage over time
- Test coverage over time
- Methods added/removed per release
- Most/least tested categories

#### 5.2 Quarterly Reviews

- Review undocumented/untested methods
- Update documentation standards as needed
- Identify patterns in gaps
- Celebrate coverage improvements

## Implementation Timeline

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1-2 | Create coverage scripts, CLI test runner | Working scripts, baseline report |
| 3-4 | Add JSDoc to top 20 methods, setup validation | JSDoc standards, validation script |
| 5-6 | Generate test stubs, write priority tests | Test stubs, 80% coverage |
| 7-8 | Complete test coverage to 90% | 90% test coverage |
| 9 | Setup CI/CD integration | Automated checks in pipeline |
| 10+ | Ongoing maintenance and improvement | Sustained quality |

## Success Metrics

1. **Documentation Coverage:** 100% of exposed methods have complete JSDoc
2. **Test Coverage:** 90% of methods have automated tests
3. **Automation:** 0 manual steps to validate docs/tests
4. **Developer Experience:** New contributors can run tests with single command
5. **CI/CD:** All checks run automatically on every PR

## Benefits

### For Developers
- ✅ IDE autocomplete shows documentation
- ✅ Clear examples for every method
- ✅ Easy to find relevant tests
- ✅ Automated validation catches issues early
- ✅ Single command runs all tests

### For Users
- ✅ Comprehensive, up-to-date documentation
- ✅ Confidence in API stability
- ✅ Examples for common use cases
- ✅ Clear migration guides for deprecated methods

### For Project
- ✅ Reduced maintenance burden
- ✅ Higher code quality
- ✅ Better onboarding experience
- ✅ Easier to contribute
- ✅ Professional appearance

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Team doesn't adopt JSDoc | Make it easy with templates and validation |
| Generated docs lose custom formatting | Preserve examples, only update method listings |
| Tests too slow in CI | Run in parallel, cache dependencies |
| Coverage drops over time | Block PRs that reduce coverage |
| Too much initial work | Incremental approach, prioritize high-value methods |

## Appendix A: Script Locations

```
scripts/
├── api-coverage-report.js       # Main coverage analysis
├── test-coverage-matrix.js      # Test × API matrix
├── generate-api-docs.js         # JSDoc → API.md
├── validate-api-docs.js         # JSDoc validation
├── generate-test-stubs.js       # Create test boilerplate
├── run-api-tests.mjs            # CLI test runner
└── utils/
    ├── extract-api-methods.js   # Parse flock.js bindings
    ├── parse-jsdoc.js           # JSDoc parser
    └── test-analyzer.js         # Test file analyzer
```

## Appendix B: NPM Scripts

```json
{
  "scripts": {
    "test:api": "node scripts/run-api-tests.mjs",
    "test:api:watch": "node scripts/run-api-tests.mjs --watch",
    "docs:coverage": "node scripts/api-coverage-report.js",
    "docs:generate": "node scripts/generate-api-docs.js",
    "docs:matrix": "node scripts/test-coverage-matrix.js",
    "validate:api-docs": "node scripts/validate-api-docs.js",
    "stubs:generate": "node scripts/generate-test-stubs.js",
    "prepare": "husky install"
  }
}
```

## Appendix C: Resources

- [JSDoc Official Documentation](https://jsdoc.app/)
- [Mocha Testing Framework](https://mochajs.org/)
- [Playwright Test Runner](https://playwright.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Next Steps:**
1. Review and approve this plan
2. Create scripts directory and implement Phase 1 scripts
3. Run baseline coverage report
4. Begin JSDoc adoption for high-priority methods

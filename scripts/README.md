# Flock XR API Documentation & Testing Scripts

This directory contains automated tooling for API documentation coverage analysis and test execution.

## 📁 Directory Structure

```
scripts/
├── README.md                      # This file
├── api-coverage-report.mjs        # ✅ Main coverage analysis tool
├── run-api-tests.mjs              # ⚠️  CLI test runner (has issue - see below)
└── utils/
    ├── extract-api-methods.mjs    # ✅ Extracts API methods from flock.js
    ├── parse-jsdoc.mjs            # ✅ Parses JSDoc comments
    └── test-analyzer.mjs          # ✅ Analyzes test coverage
```

## ✅ Working Scripts

### 1. API Coverage Report (`api-coverage-report.mjs`)

**Status:** ✅ **WORKING PERFECTLY**

Generates a comprehensive report showing:
- API method documentation coverage (JSDoc)
- Test coverage by method
- Coverage breakdown by category
- Lists of undocumented and untested methods
- Detailed markdown report

**Usage:**
```bash
npm run docs:coverage
```

**Output:**
- Console report with statistics and color-coded results
- Markdown report saved to `reports/api-coverage.md`

**Example Output:**
```
📊 Total API Methods: 108
✅ Documented: 0 (0%)
✅ Tested: 53 (49%)
❌ Undocumented: 108
❌ Untested: 55
```

### 2. Utility Scripts

All utility scripts work perfectly and can be run independently:

```bash
# Extract all API methods
node scripts/utils/extract-api-methods.mjs

# Parse JSDoc from API files
node scripts/utils/parse-jsdoc.mjs

# Analyze test coverage
node scripts/utils/test-analyzer.mjs
```

## ⚠️ Known Issues

### CLI Test Runner (`run-api-tests.mjs`)

**Status:** ⚠️ **90% Complete - Has Vite 500 Error**

The test runner successfully:
- ✅ Starts Vite dev server
- ✅ Launches headless browser
- ✅ Loads test page infrastructure
- ❌ **Issue:** Vite returns 500 error when loading some resource

**Error:**
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

**Workaround:**
Tests can still be run manually:
1. Start dev server: `npm run dev`
2. Open browser to: `http://localhost:5173/tests/tests.html`
3. Select and run tests via UI

**To Debug:**
The issue appears to be with how Vite serves the test page or its dependencies. Possible causes:
1. Import path resolution issue in tests.html
2. Vite configuration for test directory
3. Module loading incompatibility

**Next Steps to Fix:**
1. Check Vite console output when manually loading tests.html
2. Check browser DevTools Network tab for the failing resource
3. Verify all import paths in tests/tests.html
4. May need to configure Vite to properly serve tests directory

## 📊 Current Coverage Metrics

Last run: 2025-01-04

| Metric | Value |
|--------|-------|
| Total API Methods | 108 |
| Documented (JSDoc) | 0% |
| Tested | 49% (53/108) |
| Test Files | 15 |
| Total Tests | 226 |
| Active Tests | 226 |

### Coverage by Category

| Category | Methods | Tested |
|----------|---------|--------|
| Animation | 11 | 100% ✅ |
| Transform | 9 | 100% ✅ |
| CSG/Mesh Ops | 4 | 100% ✅ |
| Materials | 11 | 73% |
| Scene | 8 | 63% |
| Physics | 8 | 50% |
| Mesh | 8 | 0% ❌ |
| Camera | 3 | 0% ❌ |
| Movement | 3 | 0% ❌ |
| Shapes | 4 | 0% ❌ |

## 🚀 Quick Start

### Generate Coverage Report
```bash
npm run docs:coverage
```

### Run Tests (Once CLI runner is fixed)
```bash
npm run test:api              # All tests
npm run test:api babylon      # Specific suite
```

### Run Tests Manually (Current workaround)
```bash
npm run dev
# Then open browser to http://localhost:5173/tests/tests.html
```

## 📝 NPM Scripts

```json
{
  "docs:coverage": "node scripts/api-coverage-report.mjs",
  "test:api": "node scripts/run-api-tests.mjs",
  "test:api:watch": "node scripts/run-api-tests.mjs --watch",
  "docs:matrix": "node scripts/test-coverage-matrix.mjs",
  "validate:api-docs": "node scripts/validate-api-docs.mjs"
}
```

Note: Only `docs:coverage` is currently functional.

## 🎯 Next Steps

### Immediate
1. ⬜ Fix CLI test runner Vite 500 error
2. ⬜ Validate end-to-end test execution
3. ⬜ Implement `test-coverage-matrix.mjs`
4. ⬜ Implement `validate-api-docs.mjs`

### Short Term
5. ⬜ Add JSDoc to top 20 methods
6. ⬜ Write tests for untested categories (Mesh, Camera, Movement, Shapes)
7. ⬜ Reach 80% test coverage
8. ⬜ Setup pre-commit hooks

### Medium Term
9. ⬜ Complete JSDoc for all methods
10. ⬜ Reach 90% test coverage
11. ⬜ Add CI/CD workflow
12. ⬜ Generate API documentation site

## 📚 Documentation

- [API Reconciliation Plan](../docs/API_RECONCILIATION_PLAN.md) - Complete strategy
- [Implementation Status](../docs/IMPLEMENTATION_STATUS.md) - Current progress
- [Coverage Report](../reports/api-coverage.md) - Latest detailed report

## 🐛 Reporting Issues

If you encounter issues with the scripts:

1. Check that dependencies are installed: `npm install`
2. Verify you're in the project root directory
3. Check Node.js version: `node --version` (requires 18+)
4. Review console output for specific error messages
5. Check the documentation files listed above

## 💡 Tips

- Run `docs:coverage` regularly to track progress
- The coverage report updates automatically when you add tests or JSDoc
- Tests are detected automatically by scanning test files for `flock.methodName()` calls
- JSDoc is detected by parsing `api/*.js` files for `/** ... */` comments

---

**Last Updated:** 2025-01-04
**Status:** Phase 1 - 90% Complete

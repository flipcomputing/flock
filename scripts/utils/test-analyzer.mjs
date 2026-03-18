import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyzes test files to find which methods are tested
 * @returns {Map<string, Array<string>>} Map of method name to test files
 */
export function analyzeTestCoverage() {
  const testsDir = path.resolve(__dirname, '../../tests');
  const testFiles = fs.readdirSync(testsDir)
    .filter(f => f.endsWith('.test.js'));

  const methodTestMap = new Map();

  for (const file of testFiles) {
    const filePath = path.join(testsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Find method calls like: flock.methodName(
    const methodCallPattern = /flock\.(\w+)\s*\(/g;

    let match;
    while ((match = methodCallPattern.exec(content)) !== null) {
      const methodName = match[1];

      if (!methodTestMap.has(methodName)) {
        methodTestMap.set(methodName, []);
      }

      if (!methodTestMap.get(methodName).includes(file)) {
        methodTestMap.get(methodName).push(file);
      }
    }
  }

  return methodTestMap;
}

/**
 * Get test suites defined in tests.html
 * @returns {Array<Object>} Array of test suite definitions
 */
export function getTestSuites() {
  const testsHtmlPath = path.resolve(__dirname, '../../tests/tests.html');
  const content = fs.readFileSync(testsHtmlPath, 'utf-8');

  // Extract testSuiteDefinitions array
  const arrayMatch = content.match(/const testSuiteDefinitions = \[([\s\S]*?)\];/);

  if (!arrayMatch) {
    console.warn('Could not find testSuiteDefinitions in tests.html');
    return [];
  }

  const suites = [];
  // Parse each suite definition (simplified parsing)
  const suitePattern = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*importPath:\s*"([^"]*)",\s*importFn:\s*"([^"]*)",\s*pattern:\s*"([^"]*)"\s*\}/g;

  let match;
  while ((match = suitePattern.exec(arrayMatch[1])) !== null) {
    suites.push({
      id: match[1],
      name: match[2],
      importPath: match[3],
      importFn: match[4],
      pattern: match[5]
    });
  }

  return suites;
}

/**
 * Count tests in a test file
 * @param {string} testFilePath - Path to test file
 * @returns {Object} Test count statistics
 */
export function countTestsInFile(testFilePath) {
  const content = fs.readFileSync(testFilePath, 'utf-8');

  // Count describe blocks
  const describeMatches = content.match(/describe\(/g);
  const describeCount = describeMatches ? describeMatches.length : 0;

  // Count it blocks
  const itMatches = content.match(/it\(/g);
  const itCount = itMatches ? itMatches.length : 0;

  // Count skipped tests
  const skipMatches = content.match(/it\.skip\(/g);
  const skipCount = skipMatches ? skipMatches.length : 0;

  return {
    describes: describeCount,
    tests: itCount,
    skipped: skipCount,
    active: itCount - skipCount
  };
}

/**
 * Get comprehensive test statistics
 * @returns {Object} Statistics about all tests
 */
export function getTestStatistics() {
  const testsDir = path.resolve(__dirname, '../../tests');
  const testFiles = fs.readdirSync(testsDir)
    .filter(f => f.endsWith('.test.js'));

  let totalTests = 0;
  let totalSkipped = 0;
  let totalDescribes = 0;

  const fileStats = {};

  for (const file of testFiles) {
    const filePath = path.join(testsDir, file);
    const stats = countTestsInFile(filePath);

    fileStats[file] = stats;
    totalTests += stats.tests;
    totalSkipped += stats.skipped;
    totalDescribes += stats.describes;
  }

  return {
    totalFiles: testFiles.length,
    totalTests,
    totalSkipped,
    totalActive: totalTests - totalSkipped,
    totalDescribes,
    fileStats
  };
}

/**
 * Find methods that are not tested
 * @param {Array<string>} allMethods - All API method names
 * @param {Map<string, Array<string>>} testCoverage - Test coverage map
 * @returns {Array<string>} Untested method names
 */
export function findUntestedMethods(allMethods, testCoverage) {
  return allMethods.filter(method => !testCoverage.has(method));
}

// If run directly, output test analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Test Coverage Analysis');
  console.log('======================\n');

  const coverage = analyzeTestCoverage();
  console.log(`Methods tested: ${coverage.size}`);

  console.log('\nMethods with most test coverage:');
  const sorted = Array.from(coverage.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  sorted.forEach(([method, files]) => {
    console.log(`  ${method}: ${files.length} test file(s)`);
  });

  console.log('\nTest Statistics:');
  const stats = getTestStatistics();
  console.log(`  Total test files: ${stats.totalFiles}`);
  console.log(`  Total tests: ${stats.totalTests}`);
  console.log(`  Active tests: ${stats.totalActive}`);
  console.log(`  Skipped tests: ${stats.totalSkipped}`);
  console.log(`  Describe blocks: ${stats.totalDescribes}`);

  console.log('\nTest Suites:');
  const suites = getTestSuites();
  console.log(`  Found ${suites.length} test suite definitions`);
  suites.slice(0, 5).forEach(suite => {
    console.log(`  - ${suite.name} (${suite.id})`);
  });
}

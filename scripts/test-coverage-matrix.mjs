#!/usr/bin/env node

/**
 * Test Coverage Matrix Script
 *
 * Generates a matrix showing the relationship between API files and their test files,
 * including test counts and staleness tracking (API changes since tests were updated).
 *
 * Usage: npm run docs:matrix
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { countTestsInFile } from './utils/test-analyzer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Get the last modification date of a file from git
 * @param {string} filePath - Path to the file (relative to project root)
 * @returns {string|null} ISO date string or null if not in git
 */
function getGitLastModified(filePath) {
  try {
    const result = execSync(
      `git log -1 --format="%ai" -- "${filePath}"`,
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return result ? result.split(' ')[0] : null;
  } catch {
    return null;
  }
}

/**
 * Count the number of commits to a file since a given date
 * @param {string} filePath - Path to the file (relative to project root)
 * @param {string} sinceDate - ISO date string
 * @returns {number} Number of commits
 */
function getCommitsSince(filePath, sinceDate) {
  if (!sinceDate) return 0;
  try {
    const result = execSync(
      `git log --oneline --after="${sinceDate}" -- "${filePath}"`,
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return result ? result.split('\n').length : 0;
  } catch {
    return 0;
  }
}

/**
 * Find test files that correspond to an API file
 * @param {string} apiFileName - Name of the API file (e.g., 'animate.js')
 * @param {string[]} testFiles - Array of all test file names
 * @returns {string[]} Matching test file names
 */
function findMatchingTestFiles(apiFileName, testFiles) {
  const baseName = apiFileName.replace('.js', '');
  const matches = [];

  for (const testFile of testFiles) {
    // Match patterns like:
    // - animate.test.js (exact match)
    // - transform.rotate.test.js (prefix match for transform.js)
    // - materials.test.js (plural form of material.js)
    // - uitextbutton.test.js (contains 'ui')
    const testBaseName = testFile.replace('.test.js', '');

    if (testBaseName === baseName) {
      matches.push(testFile);
    } else if (testBaseName.startsWith(baseName + '.')) {
      // e.g., transform.rotate.test.js for transform.js
      matches.push(testFile);
    } else if (testBaseName === baseName + 's') {
      // e.g., materials.test.js for material.js
      matches.push(testFile);
    } else if (baseName === 'sound' && testFile.startsWith('sound')) {
      // Special case: sound has multiple test files
      matches.push(testFile);
    } else if (baseName === 'ui' && testFile.includes('ui')) {
      // Special case: ui has uitextbutton.test.js
      matches.push(testFile);
    }
  }

  return matches;
}

/**
 * Get staleness status indicator
 * @param {number} commitsBehind - Number of commits behind
 * @returns {string} Status indicator with emoji
 */
function getStalenessIndicator(commitsBehind) {
  if (commitsBehind === 0) return '✅';
  if (commitsBehind <= 5) return '🟡';
  if (commitsBehind <= 15) return '🟠';
  return '🔴';
}

/**
 * Main function to generate the test coverage matrix
 */
function generateTestCoverageMatrix() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    API File to Test File Coverage Matrix                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  const apiDir = path.join(projectRoot, 'api');
  const testsDir = path.join(projectRoot, 'tests');

  // Get all API files
  const apiFiles = fs.readdirSync(apiDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  // Get all test files
  const testFiles = fs.readdirSync(testsDir)
    .filter(f => f.endsWith('.test.js'))
    .sort();

  // Build the matrix data
  const matrixData = [];
  let totalTests = 0;
  let filesWithTests = 0;
  let filesWithStaleTests = 0;
  let filesWithNoTests = 0;

  for (const apiFile of apiFiles) {
    const apiPath = `api/${apiFile}`;
    const apiLastModified = getGitLastModified(apiPath);

    // Find matching test files
    const matchingTests = findMatchingTestFiles(apiFile, testFiles);

    let testCount = 0;
    let testLastModified = null;
    let commitsBehind = 0;
    const testFileDetails = [];

    if (matchingTests.length > 0) {
      filesWithTests++;

      for (const testFile of matchingTests) {
        const testPath = path.join(testsDir, testFile);
        const stats = countTestsInFile(testPath);
        testCount += stats.tests;

        const testModDate = getGitLastModified(`tests/${testFile}`);
        if (!testLastModified || (testModDate && testModDate > testLastModified)) {
          testLastModified = testModDate;
        }

        testFileDetails.push({
          name: testFile,
          tests: stats.tests,
          lastModified: testModDate
        });
      }

      // Calculate staleness
      if (testLastModified && apiLastModified) {
        commitsBehind = getCommitsSince(apiPath, testLastModified);
        if (commitsBehind > 0) {
          filesWithStaleTests++;
        }
      }
    } else {
      filesWithNoTests++;
    }

    totalTests += testCount;

    matrixData.push({
      apiFile,
      apiLastModified,
      testFiles: testFileDetails,
      testCount,
      testLastModified,
      commitsBehind,
      hasTests: matchingTests.length > 0
    });
  }

  // Print summary statistics
  console.log('┌─────────────────────────────────────────┐');
  console.log('│           Summary Statistics            │');
  console.log('└─────────────────────────────────────────┘\n');

  console.log(`  Total API Files:         ${apiFiles.length}`);
  console.log(`  Files with Tests:        ${filesWithTests} (${Math.round(filesWithTests / apiFiles.length * 100)}%)`);
  console.log(`  Files without Tests:     ${filesWithNoTests} (${Math.round(filesWithNoTests / apiFiles.length * 100)}%)`);
  console.log(`  Files with Stale Tests:  ${filesWithStaleTests}`);
  console.log(`  Total Test Cases:        ${totalTests}`);
  console.log('');

  // Print the matrix table
  console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                                        API File to Test Mapping                                            │');
  console.log('└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘\n');

  // Table header
  const header = [
    'API File'.padEnd(16),
    'Last Modified'.padEnd(12),
    'Test File(s)'.padEnd(38),
    'Tests'.padStart(5),
    'Test Modified'.padEnd(12),
    'Stale'.padStart(5),
    'Status'
  ].join(' │ ');

  console.log('  ' + header);
  console.log('  ' + '─'.repeat(header.length));

  // Table rows
  for (const row of matrixData) {
    const testFileStr = row.testFiles.length > 0
      ? row.testFiles.map(t => t.name).join(', ').substring(0, 36)
      : '(none)';

    const stalenessStr = row.hasTests
      ? (row.commitsBehind > 0 ? row.commitsBehind.toString() : '0')
      : '-';

    const statusIndicator = row.hasTests
      ? getStalenessIndicator(row.commitsBehind)
      : '❌';

    const rowStr = [
      row.apiFile.padEnd(16),
      (row.apiLastModified || '-').padEnd(12),
      testFileStr.padEnd(38),
      row.testCount.toString().padStart(5),
      (row.testLastModified || '-').padEnd(12),
      stalenessStr.padStart(5),
      statusIndicator
    ].join(' │ ');

    console.log('  ' + rowStr);
  }

  console.log('');

  // Print staleness legend
  console.log('  Staleness Legend:');
  console.log('    ✅ = Up to date (0 commits behind)');
  console.log('    🟡 = Slightly stale (1-5 commits behind)');
  console.log('    🟠 = Moderately stale (6-15 commits behind)');
  console.log('    🔴 = Very stale (>15 commits behind)');
  console.log('    ❌ = No tests');
  console.log('');

  // Print files needing attention
  const staleFiles = matrixData
    .filter(r => r.hasTests && r.commitsBehind > 0)
    .sort((a, b) => b.commitsBehind - a.commitsBehind);

  if (staleFiles.length > 0) {
    console.log('┌─────────────────────────────────────────┐');
    console.log('│     Files Needing Test Updates          │');
    console.log('└─────────────────────────────────────────┘\n');

    for (const file of staleFiles) {
      console.log(`  ${getStalenessIndicator(file.commitsBehind)} ${file.apiFile.padEnd(16)} - ${file.commitsBehind} commit(s) since tests updated`);
    }
    console.log('');
  }

  // Print files without tests
  const noTestFiles = matrixData.filter(r => !r.hasTests);
  if (noTestFiles.length > 0) {
    console.log('┌─────────────────────────────────────────┐');
    console.log('│       Files Without Direct Tests        │');
    console.log('└─────────────────────────────────────────┘\n');

    for (const file of noTestFiles) {
      console.log(`  ❌ ${file.apiFile}`);
    }
    console.log('');
  }

  // Generate and save markdown report
  const reportsDir = path.join(projectRoot, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const markdownReport = generateMarkdownReport(matrixData, {
    totalApiFiles: apiFiles.length,
    filesWithTests,
    filesWithNoTests,
    filesWithStaleTests,
    totalTests
  });

  const reportPath = path.join(reportsDir, 'test-coverage-matrix.md');
  fs.writeFileSync(reportPath, markdownReport);
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);

  // Return exit code based on coverage
  const coveragePercent = Math.round(filesWithTests / apiFiles.length * 100);
  if (coveragePercent < 50) {
    console.log(`⚠️  Warning: Only ${coveragePercent}% of API files have direct tests\n`);
  }
}

/**
 * Generate markdown report
 * @param {Array} matrixData - The matrix data
 * @param {Object} stats - Summary statistics
 * @returns {string} Markdown content
 */
function generateMarkdownReport(matrixData, stats) {
  const now = new Date().toISOString();

  let md = '# Test Coverage Matrix Report\n\n';
  md += `**Generated:** ${now}\n\n`;

  md += '## Summary\n\n';
  md += `- **Total API Files:** ${stats.totalApiFiles}\n`;
  md += `- **Files with Tests:** ${stats.filesWithTests} (${Math.round(stats.filesWithTests / stats.totalApiFiles * 100)}%)\n`;
  md += `- **Files without Tests:** ${stats.filesWithNoTests}\n`;
  md += `- **Files with Stale Tests:** ${stats.filesWithStaleTests}\n`;
  md += `- **Total Test Cases:** ${stats.totalTests}\n\n`;

  md += '## Coverage Matrix\n\n';
  md += '| API File | Last Modified | Test File(s) | Tests | Test Modified | Commits Behind | Status |\n';
  md += '|----------|---------------|--------------|------:|---------------|---------------:|--------|\n';

  for (const row of matrixData) {
    const testFileStr = row.testFiles.length > 0
      ? row.testFiles.map(t => `\`${t.name}\``).join(', ')
      : '(none)';

    const stalenessStr = row.hasTests
      ? row.commitsBehind.toString()
      : '-';

    const statusIndicator = row.hasTests
      ? getStalenessIndicator(row.commitsBehind)
      : '❌';

    md += `| ${row.apiFile} | ${row.apiLastModified || '-'} | ${testFileStr} | ${row.testCount} | ${row.testLastModified || '-'} | ${stalenessStr} | ${statusIndicator} |\n`;
  }

  md += '\n## Staleness Legend\n\n';
  md += '- ✅ = Up to date (0 commits behind)\n';
  md += '- 🟡 = Slightly stale (1-5 commits behind)\n';
  md += '- 🟠 = Moderately stale (6-15 commits behind)\n';
  md += '- 🔴 = Very stale (>15 commits behind)\n';
  md += '- ❌ = No tests\n\n';

  // Files needing attention
  const staleFiles = matrixData
    .filter(r => r.hasTests && r.commitsBehind > 0)
    .sort((a, b) => b.commitsBehind - a.commitsBehind);

  if (staleFiles.length > 0) {
    md += '## Files Needing Test Updates\n\n';
    md += 'These API files have been modified since their tests were last updated:\n\n';

    for (const file of staleFiles) {
      md += `- **${file.apiFile}** - ${file.commitsBehind} commit(s) behind ${getStalenessIndicator(file.commitsBehind)}\n`;
    }
    md += '\n';
  }

  // Files without tests
  const noTestFiles = matrixData.filter(r => !r.hasTests);
  if (noTestFiles.length > 0) {
    md += '## Files Without Direct Tests\n\n';
    md += 'These API files do not have dedicated test files:\n\n';

    for (const file of noTestFiles) {
      md += `- [ ] \`${file.apiFile}\`\n`;
    }
    md += '\n';
  }

  // Detailed test file breakdown
  md += '## Test File Details\n\n';

  for (const row of matrixData) {
    if (row.testFiles.length > 0) {
      md += `### ${row.apiFile}\n\n`;
      md += `| Test File | Tests | Last Modified |\n`;
      md += `|-----------|------:|---------------|\n`;

      for (const testFile of row.testFiles) {
        md += `| ${testFile.name} | ${testFile.tests} | ${testFile.lastModified || '-'} |\n`;
      }
      md += '\n';
    }
  }

  return md;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTestCoverageMatrix();
}

export { generateTestCoverageMatrix, findMatchingTestFiles, getGitLastModified, getCommitsSince };

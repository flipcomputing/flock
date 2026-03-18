#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractApiMethods, findMethodImplementation, categorizeMethod } from './utils/extract-api-methods.mjs';
import { parseAllApiFiles, isJSDocComplete } from './utils/parse-jsdoc.mjs';
import { analyzeTestCoverage, getTestStatistics } from './utils/test-analyzer.mjs';
import { parseApiMd, getDocumentationStatus } from './utils/parse-api-md.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate comprehensive API coverage report
 */
function generateCoverageReport() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║       API Documentation & Test Coverage Report                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // 1. Extract all API methods from flock.js
  const apiMethods = extractApiMethods();
  console.log(`📊 Total API Methods: ${apiMethods.length}\n`);

  // 2. Parse JSDoc from all API files
  const jsdocMap = parseAllApiFiles();

  // 3. Parse API.md documentation
  const apiMdMethods = parseApiMd();
  console.log(`📖 API.md Documentation: ${apiMdMethods.size} methods\n`);

  // 4. Analyze test coverage
  const testCoverageMap = analyzeTestCoverage();
  const testStats = getTestStatistics();

  // 5. Build comprehensive data structure
  const methodData = apiMethods.map(({ name, line }) => {
    const impl = findMethodImplementation(name);
    const category = categorizeMethod(impl);
    const jsdoc = jsdocMap.get(name);
    const docStatus = getDocumentationStatus(name, jsdocMap, apiMdMethods);
    const docComplete = jsdoc && isJSDocComplete(jsdoc);
    const testFiles = testCoverageMap.get(name) || [];
    const isTested = testFiles.length > 0;

    return {
      name,
      line,
      implementation: impl || 'flock.js',
      category,
      hasJSDoc: docStatus.hasJSDoc,
      hasApiMdDoc: docStatus.hasApiMdDoc,
      hasAnyDoc: docStatus.hasAnyDoc,
      docType: docStatus.docType,
      docComplete,
      isTested,
      testFiles,
      jsdoc
    };
  });

  // 6. Calculate statistics
  const documented = methodData.filter(m => m.hasAnyDoc).length;
  const jsdocOnly = methodData.filter(m => m.docType === 'jsdoc').length;
  const apiMdOnly = methodData.filter(m => m.docType === 'api.md').length;
  const bothDocs = methodData.filter(m => m.docType === 'both').length;
  const docComplete = methodData.filter(m => m.docComplete).length;
  const tested = methodData.filter(m => m.isTested).length;

  // 6. Group by category
  const byCategory = {};
  methodData.forEach(method => {
    if (!byCategory[method.category]) {
      byCategory[method.category] = [];
    }
    byCategory[method.category].push(method);
  });

  // 7. Print summary
  console.log('┌─────────────────────────────────────────┐');
  console.log('│           Summary Statistics            │');
  console.log('└─────────────────────────────────────────┘\n');

  console.log(`  Total Methods:           ${apiMethods.length}`);
  console.log(`  ✅ Documented:           ${documented} (${Math.round(documented / apiMethods.length * 100)}%)`);
  console.log(`     ├─ API.md only:       ${apiMdOnly} methods`);
  console.log(`     ├─ JSDoc only:        ${jsdocOnly} methods`);
  console.log(`     └─ Both (API.md+JSDoc): ${bothDocs} methods`);
  console.log(`  ✅ Complete JSDoc:       ${docComplete} (${Math.round(docComplete / apiMethods.length * 100)}%)`);
  console.log(`  ✅ Tested:               ${tested} (${Math.round(tested / apiMethods.length * 100)}%)`);
  console.log(`  ❌ Undocumented:         ${apiMethods.length - documented}`);
  console.log(`  ❌ Untested:             ${apiMethods.length - tested}`);

  console.log(`\n  Test Statistics:`);
  console.log(`  Total Test Files:        ${testStats.totalFiles}`);
  console.log(`  Total Tests:             ${testStats.totalTests}`);
  console.log(`  Active Tests:            ${testStats.totalActive}`);
  console.log(`  Skipped Tests:           ${testStats.totalSkipped}`);

  // 8. Print undocumented methods
  const undocumented = methodData.filter(m => !m.hasAnyDoc);
  if (undocumented.length > 0) {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│        Undocumented Methods             │');
    console.log('│   (No API.md or JSDoc documentation)    │');
    console.log('└─────────────────────────────────────────┘\n');

    undocumented.forEach(m => {
      console.log(`  ❌ ${m.name.padEnd(30)} (${m.implementation})`);
    });
  }

  // 9. Print untested methods
  const untested = methodData.filter(m => !m.isTested);
  if (untested.length > 0) {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│           Untested Methods              │');
    console.log('└─────────────────────────────────────────┘\n');

    untested.forEach(m => {
      console.log(`  ❌ ${m.name.padEnd(30)} (${m.implementation})`);
    });
  }

  // 10. Print coverage by category
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│         Coverage by Category            │');
  console.log('└─────────────────────────────────────────┘\n');

  const sortedCategories = Object.entries(byCategory)
    .sort((a, b) => b[1].length - a[1].length);

  sortedCategories.forEach(([category, methods]) => {
    const doced = methods.filter(m => m.hasAnyDoc).length;
    const apiMd = methods.filter(m => m.hasApiMdDoc).length;
    const jsdoc = methods.filter(m => m.hasJSDoc).length;
    const tested = methods.filter(m => m.isTested).length;
    const total = methods.length;

    const docPercent = Math.round(doced / total * 100);
    const testPercent = Math.round(tested / total * 100);

    const icon = (docPercent === 100 && testPercent === 100) ? '✅' :
                 (docPercent >= 75 && testPercent >= 75) ? '⚠️ ' : '❌';

    console.log(`  ${icon} ${category.padEnd(25)} ${total} methods`);
    console.log(`     Documentation: ${doced}/${total} (${docPercent}%) [API.md: ${apiMd}, JSDoc: ${jsdoc}]`);
    console.log(`     Tests:         ${tested}/${total} (${testPercent}%)`);
    console.log('');
  });

  // 11. Print most tested methods
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│        Most Tested Methods              │');
  console.log('└─────────────────────────────────────────┘\n');

  const mostTested = methodData
    .filter(m => m.isTested)
    .sort((a, b) => b.testFiles.length - a.testFiles.length)
    .slice(0, 10);

  mostTested.forEach(m => {
    console.log(`  ${m.name.padEnd(30)} ${m.testFiles.length} test file(s)`);
  });

  // 12. Save detailed report to file
  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'api-coverage.md');
  const markdownReport = generateMarkdownReport(methodData, testStats);
  fs.writeFileSync(reportPath, markdownReport);

  console.log(`\n📄 Detailed report saved to: ${reportPath}\n`);

  // 13. Exit code based on coverage
  const MIN_DOC_COVERAGE = 50; // 50% minimum
  const MIN_TEST_COVERAGE = 70; // 70% minimum

  const docCoverage = Math.round(documented / apiMethods.length * 100);
  const testCoverage = Math.round(tested / apiMethods.length * 100);

  if (docCoverage < MIN_DOC_COVERAGE || testCoverage < MIN_TEST_COVERAGE) {
    console.log(`⚠️  Warning: Coverage below thresholds`);
    console.log(`   Documentation: ${docCoverage}% (min: ${MIN_DOC_COVERAGE}%)`);
    console.log(`   Tests: ${testCoverage}% (min: ${MIN_TEST_COVERAGE}%)\n`);
    // Don't fail for now, just warn
    // process.exit(1);
  }
}

/**
 * Generate detailed markdown report
 */
function generateMarkdownReport(methodData, testStats) {
  let md = '# API Documentation & Test Coverage Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;

  const totalDocs = methodData.filter(m => m.hasAnyDoc).length;
  const apiMdDocs = methodData.filter(m => m.hasApiMdDoc).length;
  const jsdocDocs = methodData.filter(m => m.hasJSDoc).length;
  const bothDocs = methodData.filter(m => m.docType === 'both').length;

  md += '## Summary\n\n';
  md += `- **Total Methods:** ${methodData.length}\n`;
  md += `- **Documented:** ${totalDocs} (${Math.round(totalDocs / methodData.length * 100)}%)\n`;
  md += `  - API.md only: ${apiMdDocs - bothDocs}\n`;
  md += `  - JSDoc only: ${jsdocDocs - bothDocs}\n`;
  md += `  - Both (API.md + JSDoc): ${bothDocs}\n`;
  md += `- **Tested:** ${methodData.filter(m => m.isTested).length} (${Math.round(methodData.filter(m => m.isTested).length / methodData.length * 100)}%)\n`;
  md += `- **Total Tests:** ${testStats.totalTests}\n`;
  md += `- **Active Tests:** ${testStats.totalActive}\n\n`;

  md += '## Methods Overview\n\n';
  md += '| Method | Category | Documentation | Doc Type | Tests | Implementation |\n';
  md += '|--------|----------|---------------|----------|-------|----------------|\n';

  methodData.forEach(m => {
    const docIcon = m.hasAnyDoc ? '✅' : '❌';
    const docTypeLabel = m.docType === 'both' ? 'API.md+JSDoc' :
                         m.docType === 'api.md' ? 'API.md' :
                         m.docType === 'jsdoc' ? 'JSDoc' : 'None';
    const testIcon = m.isTested ? '✅' : '❌';
    const testCount = m.testFiles.length > 0 ? `${m.testFiles.length}` : '0';

    md += `| ${m.name} | ${m.category} | ${docIcon} | ${docTypeLabel} | ${testIcon} (${testCount}) | ${m.implementation} |\n`;
  });

  md += '\n## Undocumented Methods\n\n';
  md += '*(Methods with no API.md or JSDoc documentation)*\n\n';
  const undocumented = methodData.filter(m => !m.hasAnyDoc);
  if (undocumented.length === 0) {
    md += '✅ All methods have documentation!\n\n';
  } else {
    undocumented.forEach(m => {
      md += `- [ ] \`${m.name}\` (${m.implementation})\n`;
    });
    md += '\n';
  }

  md += '## Untested Methods\n\n';
  const untested = methodData.filter(m => !m.isTested);
  if (untested.length === 0) {
    md += '✅ All methods have tests!\n\n';
  } else {
    untested.forEach(m => {
      md += `- [ ] \`${m.name}\` (${m.implementation})\n`;
    });
    md += '\n';
  }

  md += '## Coverage by Category\n\n';
  const byCategory = {};
  methodData.forEach(method => {
    if (!byCategory[method.category]) {
      byCategory[method.category] = [];
    }
    byCategory[method.category].push(method);
  });

  Object.entries(byCategory).forEach(([category, methods]) => {
    const doced = methods.filter(m => m.hasAnyDoc).length;
    const apiMd = methods.filter(m => m.hasApiMdDoc).length;
    const jsdoc = methods.filter(m => m.hasJSDoc).length;
    const tested = methods.filter(m => m.isTested).length;
    const total = methods.length;

    md += `### ${category}\n\n`;
    md += `- Documentation: ${doced}/${total} (${Math.round(doced / total * 100)}%)\n`;
    md += `  - API.md: ${apiMd}\n`;
    md += `  - JSDoc: ${jsdoc}\n`;
    md += `- Tests: ${tested}/${total} (${Math.round(tested / total * 100)}%)\n\n`;
  });

  return md;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateCoverageReport();
}

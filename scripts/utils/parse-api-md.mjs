#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Parse API.md and extract all documented method names
 * @returns {Set<string>} Set of method names documented in API.md
 */
export function parseApiMd() {
  const apiMdPath = path.resolve(process.cwd(), 'API.md');

  if (!fs.existsSync(apiMdPath)) {
    console.warn('⚠️  API.md not found');
    return new Set();
  }

  const content = fs.readFileSync(apiMdPath, 'utf-8');
  const lines = content.split('\n');

  const documentedMethods = new Set();

  // Pattern: #### `methodName(params)`
  const methodPattern = /^####\s+`([a-zA-Z_][a-zA-Z0-9_]*)\(/;

  lines.forEach(line => {
    const match = line.match(methodPattern);
    if (match) {
      const methodName = match[1];
      documentedMethods.add(methodName);
    }
  });

  return documentedMethods;
}

/**
 * Get documentation status for a method
 * @param {string} methodName - Name of the method
 * @param {Map} jsdocMap - Map of JSDoc data from parse-jsdoc
 * @param {Set} apiMdMethods - Set of methods documented in API.md
 * @returns {object} Documentation status
 */
export function getDocumentationStatus(methodName, jsdocMap, apiMdMethods) {
  const hasJSDoc = jsdocMap.has(methodName) && jsdocMap.get(methodName).hasDoc;
  const hasApiMdDoc = apiMdMethods.has(methodName);

  return {
    hasJSDoc,
    hasApiMdDoc,
    hasAnyDoc: hasJSDoc || hasApiMdDoc,
    docType: hasJSDoc && hasApiMdDoc ? 'both' :
             hasJSDoc ? 'jsdoc' :
             hasApiMdDoc ? 'api.md' :
             'none'
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n📖 Parsing API.md for documented methods...\n');

  const documentedMethods = parseApiMd();

  console.log(`✅ Found ${documentedMethods.size} documented methods in API.md:\n`);

  const sorted = Array.from(documentedMethods).sort();
  sorted.forEach((method, index) => {
    console.log(`  ${(index + 1).toString().padStart(3)}. ${method}`);
  });

  console.log('');
}

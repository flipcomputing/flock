import fs from 'fs';
import path from 'path';

/**
 * Parses JSDoc comments from a JavaScript file
 * @param {string} filePath - Path to the JavaScript file
 * @returns {Map<string, Object>} Map of method name to JSDoc data
 */
export function parseJSDoc(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const jsdocMap = new Map();

  // Match JSDoc blocks followed by method definitions
  // Pattern: /** ... */ followed by methodName(...) {
  const jsdocPattern = /\/\*\*([\s\S]*?)\*\/\s*(?:async\s+)?(\w+)\s*\(/g;

  let match;
  while ((match = jsdocPattern.exec(content)) !== null) {
    const jsdocContent = match[1];
    const methodName = match[2];

    const docData = {
      raw: match[0],
      hasDoc: true,
      description: extractDescription(jsdocContent),
      params: extractParams(jsdocContent),
      returns: extractReturns(jsdocContent),
      examples: extractExamples(jsdocContent),
      category: extractTag(jsdocContent, 'category'),
      tested: extractTag(jsdocContent, 'tested'),
      deprecated: hasTag(jsdocContent, 'deprecated'),
      since: extractTag(jsdocContent, 'since'),
      tags: extractAllTags(jsdocContent)
    };

    jsdocMap.set(methodName, docData);
  }

  return jsdocMap;
}

/**
 * Extract description from JSDoc content
 */
function extractDescription(jsdocContent) {
  const lines = jsdocContent.split('\n').map(l => l.trim().replace(/^\*\s?/, ''));
  const description = [];

  for (const line of lines) {
    if (line.startsWith('@')) break;
    if (line) description.push(line);
  }

  return description.join(' ').trim();
}

/**
 * Extract @param tags
 */
function extractParams(jsdocContent) {
  const paramPattern = /@param\s+\{([^}]+)\}\s+(\[?[\w.]+\]?)\s*-?\s*(.*)/g;
  const params = [];

  let match;
  while ((match = paramPattern.exec(jsdocContent)) !== null) {
    const paramName = match[2].replace(/[\[\]]/g, '');
    params.push({
      type: match[1],
      name: paramName,
      optional: match[2].startsWith('['),
      description: match[3]
    });
  }

  return params;
}

/**
 * Extract @returns tag
 */
function extractReturns(jsdocContent) {
  const returnPattern = /@returns?\s+\{([^}]+)\}\s*(.*)/;
  const match = jsdocContent.match(returnPattern);

  if (match) {
    return {
      type: match[1],
      description: match[2]
    };
  }

  return null;
}

/**
 * Extract @example blocks
 */
function extractExamples(jsdocContent) {
  const examples = [];
  const examplePattern = /@example\s*([\s\S]*?)(?=@\w+|$)/g;

  let match;
  while ((match = examplePattern.exec(jsdocContent)) !== null) {
    const example = match[1]
      .split('\n')
      .map(l => l.trim().replace(/^\*\s?/, ''))
      .join('\n')
      .trim();

    if (example) examples.push(example);
  }

  return examples;
}

/**
 * Extract specific tag value
 */
function extractTag(jsdocContent, tagName) {
  const pattern = new RegExp(`@${tagName}\\s+([^\\n@]+)`);
  const match = jsdocContent.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Check if tag exists
 */
function hasTag(jsdocContent, tagName) {
  const pattern = new RegExp(`@${tagName}\\b`);
  return pattern.test(jsdocContent);
}

/**
 * Extract all tags
 */
function extractAllTags(jsdocContent) {
  const tagPattern = /@(\w+)/g;
  const tags = new Set();

  let match;
  while ((match = tagPattern.exec(jsdocContent)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags);
}

/**
 * Check if JSDoc is complete (has description, params, returns, example)
 */
export function isJSDocComplete(docData) {
  if (!docData || !docData.hasDoc) return false;

  return !!(
    docData.description &&
    docData.returns &&
    docData.examples.length > 0
  );
}

/**
 * Parse all API files and return JSDoc map
 */
export function parseAllApiFiles() {
  const apiDir = path.resolve(process.cwd(), 'api');
  const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));

  const allDocs = new Map();

  for (const file of apiFiles) {
    const filePath = path.join(apiDir, file);
    const docs = parseJSDoc(filePath);

    // Add file info to each doc
    docs.forEach((doc, methodName) => {
      doc.file = `api/${file}`;
      allDocs.set(methodName, doc);
    });
  }

  return allDocs;
}

// If run directly, test parsing
if (import.meta.url === `file://${process.argv[1]}`) {
  const allDocs = parseAllApiFiles();
  console.log(`Parsed JSDoc from ${allDocs.size} methods`);

  const complete = Array.from(allDocs.entries()).filter(([_, doc]) => isJSDocComplete(doc));
  console.log(`\nComplete documentation: ${complete.length}/${allDocs.size}`);

  console.log('\nSample documentation:');
  const sample = Array.from(allDocs.entries())[0];
  if (sample) {
    const [name, doc] = sample;
    console.log(`\n${name}:`);
    console.log(`  Description: ${doc.description}`);
    console.log(`  Params: ${doc.params.length}`);
    console.log(`  Returns: ${doc.returns ? 'Yes' : 'No'}`);
    console.log(`  Examples: ${doc.examples.length}`);
  }
}

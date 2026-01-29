import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extracts API methods from flock.js binding section (lines 865-987)
 * @returns {Array<{name: string, line: number}>} Array of method names and line numbers
 */
export function extractApiMethods() {
  const flockJsPath = path.resolve(__dirname, '../../flock.js');
  const content = fs.readFileSync(flockJsPath, 'utf-8');
  const lines = content.split('\n');

  const methods = [];
  let inApiSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Start of API binding section (around line 865)
    if (line.includes('// Flock API methods') || line.includes('Flock API methods —')) {
      inApiSection = true;
      continue;
    }

    // End of API binding section (closing brace and semicolon around line 987-988)
    if (inApiSection && line.trim() === '};') {
      break;
    }

    // Extract method bindings like: methodName: this.methodName?.bind(this),
    if (inApiSection) {
      const match = line.match(/^\s+(\w+):\s+this\.(\w+)/);
      if (match) {
        const methodName = match[1];
        methods.push({ name: methodName, line: lineNum });
      }
    }
  }

  return methods;
}

/**
 * Get the API file where a method is likely implemented
 * @param {string} methodName - Name of the method
 * @returns {string|null} File path relative to project root, or null if not found
 */
export function findMethodImplementation(methodName) {
  const apiDir = path.resolve(__dirname, '../../api');
  const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));

  for (const file of apiFiles) {
    const filePath = path.join(apiDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Look for method definition in exported object
    // Pattern: methodName(...) { or async methodName(...) {
    const pattern = new RegExp(`(?:async\\s+)?${methodName}\\s*\\([^)]*\\)\\s*\\{`);
    if (pattern.test(content)) {
      return `api/${file}`;
    }
  }

  return null;
}

/**
 * Categorize method by its implementation file
 * @param {string} filePath - Path like 'api/animate.js'
 * @returns {string} Category name
 */
export function categorizeMethod(filePath) {
  if (!filePath) return 'Unknown';

  const categoryMap = {
    'animate.js': 'Animation',
    'camera.js': 'Camera',
    'csg.js': 'CSG/Mesh Operations',
    'effects.js': 'Effects',
    'material.js': 'Materials',
    'mesh.js': 'Mesh',
    'models.js': 'Models',
    'movement.js': 'Movement',
    'physics.js': 'Physics',
    'scene.js': 'Scene',
    'shapes.js': 'Shapes',
    'sound.js': 'Sound',
    'transform.js': 'Transform',
    'ui.js': 'UI'
  };

  const fileName = path.basename(filePath);
  return categoryMap[fileName] || 'Other';
}

// If run directly, output the methods
if (import.meta.url === `file://${process.argv[1]}`) {
  const methods = extractApiMethods();
  console.log(`Found ${methods.length} API methods in flock.js`);
  console.log('\nMethods:');
  methods.forEach(m => {
    const impl = findMethodImplementation(m.name);
    console.log(`  ${m.name} (line ${m.line}) -> ${impl || 'NOT FOUND'}`);
  });
}

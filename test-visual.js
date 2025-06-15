
#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📸 Running visual regression tests...');

const playwrightProcess = spawn('npx', ['playwright', 'test', 'tests/playwright/visual.spec.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

playwrightProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Visual regression tests completed successfully!');
    console.log('📊 View HTML report: npx playwright show-report');
  } else {
    console.log(`❌ Visual regression tests failed with code ${code}`);
    console.log('🔍 Check the HTML report for visual differences');
  }
  process.exit(code);
});

playwrightProcess.on('error', (error) => {
  console.error('❌ Failed to start Playwright:', error);
  process.exit(1);
});

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('src/**/*.ts', { cwd: __dirname });

for (const file of files) {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace all relative imports that don't already have .js
  content = content.replace(
    /from ['"](\.[^'"]+)['"]/g,
    (match, importPath) => {
      if (!importPath.endsWith('.js') && !importPath.includes('index') && !importPath.includes('node_modules')) {
        changed = true;
        return match.replace(importPath, importPath + '.js');
      }
      return match;
    }
  );

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed imports in ${file}`);
  }
}
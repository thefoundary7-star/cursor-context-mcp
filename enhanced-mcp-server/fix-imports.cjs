#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('src/**/*.ts', { cwd: __dirname });

for (const file of files) {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace relative imports to add .js extension
  content = content.replace(
    /from ['"](\.\.[^'"]*)['"]/g,
    (match, importPath) => {
      // Don't add .js if it already has an extension or if it's from node_modules
      if (importPath.includes('.') && !importPath.endsWith('/')) {
        return match;
      }
      return match.replace(importPath, importPath + '.js');
    }
  );

  // Replace same-directory imports
  content = content.replace(
    /from ['"](\.[^'"]*)['"]/g,
    (match, importPath) => {
      // Don't add .js if it already has an extension
      if (importPath.includes('.') && !importPath.endsWith('/')) {
        return match;
      }
      return match.replace(importPath, importPath + '.js');
    }
  );

  fs.writeFileSync(filePath, content);
  console.log(`Fixed imports in ${file}`);
}
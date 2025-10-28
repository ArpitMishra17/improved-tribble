#!/usr/bin/env node
/**
 * Systematic TypeScript fixes for server/routes.ts
 *
 * Applies fix patterns:
 * 1. Add Promise<void> return type to route handlers
 * 2. Add explicit returns after res.json() calls
 * 3. Fix parseInt validation
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = './server/routes.ts';
let content = readFileSync(filePath, 'utf-8');
let fixes = 0;

console.log('Applying TypeScript fixes to server/routes.ts...\n');

// Pattern 1: Add Promise<void> return type to async route handlers
// Match: async (req: Request, res: Response, next: NextFunction) =>
// Add: : Promise<void>
const routeHandlerPattern = /async \(req: Request, res: Response, next: NextFunction\) =>/g;
const matches = content.match(routeHandlerPattern);
if (matches) {
  content = content.replace(
    routeHandlerPattern,
    'async (req: Request, res: Response, next: NextFunction): Promise<void> =>'
  );
  fixes += matches.length;
  console.log(`✓ Added Promise<void> return type to ${matches.length} route handlers`);
}

// Pattern 2: Add explicit return after res.json() and res.status().json()
// This is trickier - we need to find patterns where res.json() is NOT followed by return
const lines = content.split('\n');
let returnFixes = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Skip if this line already has return before res.json or is a return statement
  if (trimmed.startsWith('return res.') || trimmed.startsWith('return;')) {
    continue;
  }

  // Check if line ends with res.json(...);
  if (trimmed.match(/res\.(status\(\d+\)\.)?json\([^)]*\);$/)) {
    // Check if next line is already a return
    if (i + 1 < lines.length && lines[i + 1].trim() === 'return;') {
      continue;
    }

    // Add return; on the next line with same indentation
    const indent = line.match(/^(\s*)/)[0];
    lines.splice(i + 1, 0, `${indent}return;`);
    returnFixes++;
    i++; // Skip the line we just inserted
  }
}

content = lines.join('\n');
console.log(`✓ Added explicit returns after ${returnFixes} response calls`);
fixes += returnFixes;

// Pattern 3: Fix parseInt() calls - add radix and validation
// Note: This is complex and may need manual review, so we'll log locations instead
const parseIntMatches = content.match(/parseInt\(req\.params\.\w+\)/g);
if (parseIntMatches) {
  console.log(`\n⚠ Found ${parseIntMatches.length} parseInt() calls that may need validation`);
  console.log('  Pattern needed: const id = parseInt(req.params.id, 10); if (isNaN(id)) { res.status(400).json(...); return; }');
}

// Write the fixed content
writeFileSync(filePath, content, 'utf-8');

console.log(`\n✓ Applied ${fixes} automatic fixes to ${filePath}`);
console.log('\nRun: npm run check:server to verify improvements\n');

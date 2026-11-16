#!/usr/bin/env node
// Design-system guard (docs/design-system.md): screens and features must use tokens from src/theme.
// Fails on raw hex/rgb colors, literal font families, numeric border radii, Cloudinary URLs and Cairo.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = ['src'];

// Files allowed to hold raw values, with the reason.
const ALLOW = new Map([
  ['src/theme/tokens.ts', 'the token source itself'],
  ['src/theme/fonts.ts', 'font asset registration'],
  ['src/theme/font-resolver.ts', 'font family names'],
  ['src/domain/export.ts', 'standalone HTML for PDF export, not app UI'],
  ['src/features/auth/google-mark.tsx', "Google's brand colors are mandated by their sign-in guidelines"],
  ['src/services/media/cloudinary.ts', 'the only place that builds Cloudinary delivery URLs'],
]);

const RULES = [
  { name: 'raw hex color', re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'raw rgb/rgba color', re: /\brgba?\(/ },
  { name: 'literal fontFamily', re: /fontFamily:\s*['"`]/ },
  { name: 'numeric borderRadius', re: /borderRadius:\s*\d/ },
  { name: 'Cloudinary URL', re: /res\.cloudinary\.com/ },
  { name: 'Cairo font', re: /Cairo_\d|expo-google-fonts\/cairo|fontFamily:.*Cairo/ },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(path);
  }
  return out;
}

const problems = [];
for (const base of SCAN) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file);
    if (ALLOW.has(rel)) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, '');
        for (const rule of RULES) {
          if (rule.re.test(code)) problems.push(`${rel}:${index + 1}  ${rule.name}: ${line.trim()}`);
        }
      });
  }
}

if (problems.length) {
  console.error(`check:tokens found ${problems.length} problem(s). Use tokens from '@/theme':\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('check:tokens: no raw design values outside src/theme.');

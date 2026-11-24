#!/usr/bin/env node
/**
 * Phase 0, task 0.6: fail CI on hard-coded colours and safe-area values.
 *
 * Colours belong in `src/theme/tokens.ts`. The only exemptions are files that are
 * artwork or print markup rather than UI chrome: the SVG illustrations, the schematic
 * tracking map, and the receipt's print HTML.
 *
 * Safe-area detection targets the values that are actually device insets (34, 44, 47,
 * 59 dp) and fixed device heights, so ordinary spacing tokens are not flagged.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src');

const ARTWORK = [
  'src/lib/receipt.ts',
  'src/components/auth/welcome-illustration.tsx',
  'src/components/auth/welcome-back-illustration.tsx',
  'src/components/auth/google-glyph.tsx',
  'src/components/service/service-hero-art.tsx',
  'src/components/booking/tracking-map.tsx',
];

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : walk(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

/**
 * Hex literals are the design-token leak. Translucent `rgba()` scrims and glass
 * overlays stay inline because their alpha is tied to the surface underneath; they are
 * reviewed by eye rather than against the token table.
 */
const colourLiteral = /#[0-9a-fA-F]{3,8}\b/;
const insetLiteral = /\b(?:paddingTop|paddingBottom|paddingVertical|marginTop|marginBottom)\s*:\s*(34|44|47|59)\b/;
const deviceHeight = /\bheight\s*:\s*(812|844|852|896|926)\b/;

const violations = [];

for (const file of walk(src)) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (rel.startsWith('src/theme/') || ARTWORK.includes(rel)) continue;
  if (/\.(test|spec)\.tsx?$/.test(rel)) continue;

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (colourLiteral.test(line)) {
      violations.push(`${rel}:${index + 1}  hard-coded colour — use a token from src/theme`);
    }
    if (insetLiteral.test(line) || deviceHeight.test(line)) {
      violations.push(`${rel}:${index + 1}  hard-coded inset/height — use useSafeAreaInsets`);
    }
    if (/\brgba?\(/.test(line) && !/rgba\(/.test(line)) {
      violations.push(`${rel}:${index + 1}  opaque rgb() colour — use a token from src/theme`);
    }
  });
}

if (violations.length) {
  console.error(`\ncheck:style found ${violations.length} violation(s):\n`);
  for (const violation of violations) console.error(`  ${violation}`);
  console.error('\nMove the value into src/theme/tokens.ts, or add the file to ARTWORK in scripts/check-style.mjs if it is artwork/print markup.\n');
  process.exit(1);
}

console.log('check:style passed — no hard-coded colours or safe-area values.');

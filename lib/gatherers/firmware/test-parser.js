// Run with: node lib/gatherers/firmware/test-parser.js [path/to/file.map]
// Defaults to ./sample.map if no argument is given.
//
// All checks are dynamic — no hardcoded byte counts or product names.

import { readFileSync } from 'fs';
import { parseMapFile } from './parser.js';

// ── Load file ──────────────────────────────────────────────────────────────
const mapPath = process.argv[2] || './sample.map';
let mapContents;
try {
  mapContents = readFileSync(mapPath, 'utf8');
} catch (err) {
  console.error(`✗ Could not read "${mapPath}": ${err.message}`);
  process.exit(1);
}

const result = parseMapFile(mapContents);

// ── Pretty-print key sections ──────────────────────────────────────────────
console.log('\n=== META ===');
console.log(JSON.stringify(result.meta, null, 2));

console.log('\n=== VALIDATION ===');
console.log(JSON.stringify(result.validation, null, 2));

console.log('\n=== NODES ===');
result.nodes.forEach(n =>
  console.log(`  ${n.id.padEnd(30)} ${n.label.padEnd(25)} ${n.value} bytes`)
);

console.log('\n=== LINKS (top 10 by value) ===');
result.links
  .sort((a, b) => b.value - a.value)
  .slice(0, 10)
  .forEach(l => console.log(`  ${l.from.padEnd(20)} → ${l.to.padEnd(20)} ${l.value} bytes`));

// ── Dynamic consistency checks ─────────────────────────────────────────────
console.log('\n=== CONSISTENCY CHECKS ===');

const { flashTotal, ramTotal } = result.validation;
const nodeById = Object.fromEntries(result.nodes.map(n => [n.id, n]));
let passed = 0;
let total  = 0;

function check(label, ok, detail = '') {
  total++;
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${label}${detail ? ' — ' + detail : ''}`);
  if (ok) passed++;
}

// 1. meta.total = flashTotal + ramTotal
check(
  'meta.total === flashTotal + ramTotal',
  result.meta.total === flashTotal + ramTotal,
  `${result.meta.total} === ${flashTotal} + ${ramTotal}`
);

// 2. flashTotal > 0
check('flashTotal > 0', flashTotal > 0, `${flashTotal}`);

// 3. ramTotal > 0
check('ramTotal > 0', ramTotal > 0, `${ramTotal}`);

// 4. Every link references known node IDs
const badLinks = result.links.filter(l => !nodeById[l.from] || !nodeById[l.to]);
check(
  'All link from/to IDs exist in nodes',
  badLinks.length === 0,
  badLinks.length > 0
    ? `${badLinks.length} bad link(s): ${badLinks.map(l => `${l.from}→${l.to}`).join(', ')}`
    : `${result.links.length} links OK`
);

// 5. Sum of region→section links ≈ meta.total
//    (may differ when some sections have bytes not attributed to any source file)
const regionToSectionSum = result.links
  .filter(l => nodeById[l.from]?.column === 'region')
  .reduce((s, l) => s + l.value, 0);
check(
  'Sum of region→section links equals meta.total',
  regionToSectionSum === result.meta.total,
  `${regionToSectionSum} === ${result.meta.total}`
);

// 6. Each section node value matches its region→section link value
const sectionLinkMap = {};
result.links
  .filter(l => nodeById[l.from]?.column === 'region')
  .forEach(l => { sectionLinkMap[l.to] = l.value; });

const sectionMismatches = result.nodes
  .filter(n => n.column === 'section')
  .filter(n => sectionLinkMap[n.id] !== undefined && sectionLinkMap[n.id] !== n.value);
check(
  'Section node values match region→section link values',
  sectionMismatches.length === 0,
  sectionMismatches.length > 0
    ? sectionMismatches.map(n => `${n.id}: node=${n.value} link=${sectionLinkMap[n.id]}`).join('; ')
    : `${result.nodes.filter(n => n.column === 'section').length} section(s) OK`
);

// 7. At least one module node exists
const moduleNodes = result.nodes.filter(n => n.column === 'module');
check('At least one module node', moduleNodes.length > 0, `${moduleNodes.length} module(s)`);

// 8. Section→module links only reference section and module nodes
const badSecModLinks = result.links
  .filter(l => nodeById[l.from]?.column === 'section')
  .filter(l => nodeById[l.to]?.column !== 'module');
check(
  'All section→module links target module nodes',
  badSecModLinks.length === 0,
  badSecModLinks.length > 0
    ? `${badSecModLinks.length} bad link(s)`
    : `OK`
);

// 9. No zero-value links
const zeroLinks = result.links.filter(l => l.value === 0);
check('No zero-value links', zeroLinks.length === 0, `${zeroLinks.length} zero-value link(s)`);

// 10. No duplicate node IDs
const seen = new Set();
const dupIds = result.nodes.filter(n => { if (seen.has(n.id)) return true; seen.add(n.id); return false; });
check('No duplicate node IDs', dupIds.length === 0, dupIds.map(n => n.id).join(', ') || 'OK');

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed}/${total} checks passed`);
process.exit(passed === total ? 0 : 1);

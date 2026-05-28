#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// generate-diagram.js
//
// CLI: node lib/tools/generate-diagram.js <path-to.map> [output-path]
//
// Parses a GNU ld .map file and writes a fully self-contained, interactive
// HTML Sankey diagram.  No external dependencies — everything is inlined.
//
// Defaults:
//   output-path → output/memory-map.html
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';

// bezierPath is imported from the shared layout module so the ribbon path
// formula is defined in exactly one place (lib/creator/layout.js) and
// pre-computed server-side rather than duplicated in the client-side script.
import { bezierPath } from '../creator/layout.js';

// Resolve parser relative to this file (works regardless of CWD)
const __dir = dirname(fileURLToPath(import.meta.url));
const { parseMapFile } = await import(resolve(__dir, '../gatherers/firmware/parser.js'));

// ── CLI args ─────────────────────────────────────────────────────────────────
const [,, mapArg, outArg] = process.argv;

if (!mapArg) {
  console.error('Usage: node lib/tools/generate-diagram.js <path-to.map> [output-path]');
  process.exit(1);
}

const mapPath = resolve(mapArg);
const outPath = resolve(outArg || 'output/memory-map.html');

// ── Parse ─────────────────────────────────────────────────────────────────────
let mapContents;
try {
  mapContents = readFileSync(mapPath, 'utf8');
} catch (err) {
  console.error(`✗ Could not read "${mapPath}": ${err.message}`);
  process.exit(1);
}

const mapName = basename(mapPath);
const diagram = parseMapFile(mapContents, {
  title:  `Firmware — ${mapName}`,
  source: mapPath,
});

// ── Generate HTML ─────────────────────────────────────────────────────────────
const html = buildHtml(diagram);

// ── Write output ──────────────────────────────────────────────────────────────
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf8');
console.log(`✓ Diagram saved to: ${outPath}`);
console.log(`  Total: ${diagram.meta.total.toLocaleString()} bytes`);
console.log(`  Flash: ${diagram.validation.flashTotal.toLocaleString()} bytes`);
console.log(`  RAM:   ${diagram.validation.ramTotal.toLocaleString()} bytes`);
console.log(`  Nodes: ${diagram.nodes.length}  Links: ${diagram.links.length}`);

// ─────────────────────────────────────────────────────────────────────────────
// HTML generator — all layout and SVG rendering happens here in Node.js.
// bezierPath (imported above) is used to pre-compute ribbon path strings so
// the browser only handles interactivity (hover / tooltip), not geometry.
// ─────────────────────────────────────────────────────────────────────────────

function buildHtml(d) {
  const { meta, columns, nodes, links, validation } = d;

  // ── Layout constants (specific to this 3-column firmware diagram) ──────────
  const SVG_W    = 1004;
  const PAD_T    = 48;
  const PAD_B    = 16;
  const NODE_W   = 18;
  const GAP      = 8;
  const COL_X    = [60, 420, 780];
  const LBL_OFF  = NODE_W + 8;

  // ── Node lookup (shallow copy so we can add layout fields) ─────────────────
  const byId = {};
  nodes.forEach(n => { byId[n.id] = { ...n, _linkOutOffset: 0, _linkInOffset: 0 }; });

  // ── Column groups ──────────────────────────────────────────────────────────
  const cols = [
    nodes.filter(n => n.column === 'region'),
    nodes.filter(n => n.column === 'section'),
    nodes.filter(n => n.column === 'module'),
  ];

  function colSum(col) { return col.reduce((s, n) => s + n.value, 0); }
  const maxTotal  = Math.max(...cols.map(colSum));
  const CONTENT_H = Math.max(500, cols.reduce((m, col) => Math.max(m, col.length * (GAP + 4)), 0) + 120);
  const scale     = (CONTENT_H - PAD_T - PAD_B) / maxTotal;

  // ── Assign y-positions (server-side layout) ────────────────────────────────
  cols.forEach((col, colIdx) => {
    const total  = colSum(col);
    const barH   = total * scale;
    const gaps   = (col.length - 1) * GAP;
    const usedH  = barH + gaps;
    let y = PAD_T + (CONTENT_H - PAD_T - PAD_B - usedH) / 2;
    col.forEach(n => {
      const node = byId[n.id];
      node._x = COL_X[colIdx];
      node._h = Math.max(2, n.value * scale);
      node._y = y;
      y += node._h + GAP;
    });
  });

  const SVG_H = CONTENT_H + 20;

  // ── Pre-compute ribbon paths using bezierPath from lib/creator/layout.js ───
  // Sort so smaller/later links draw on top (matches previous client-side sort).
  const sortedLinks = [...links].sort((a, b) => {
    const ay = (byId[a.from]?._y ?? 0) + (byId[a.to]?._y ?? 0);
    const by_ = (byId[b.from]?._y ?? 0) + (byId[b.to]?._y ?? 0);
    return ay - by_;
  });

  const ribbonSvg = sortedLinks.map(link => {
    const src = byId[link.from];
    const tgt = byId[link.to];
    if (!src || !tgt) return '';

    const thickness = Math.max(1, link.value * scale);
    const x1 = src._x + NODE_W;
    const y1  = src._y + src._linkOutOffset + thickness / 2;
    src._linkOutOffset += thickness;
    const x2 = tgt._x;
    const y2  = tgt._y + tgt._linkInOffset  + thickness / 2;
    tgt._linkInOffset  += thickness;

    // bezierPath(x1,y1,t1,x2,y2,t2) — same formula, now imported rather than duplicated
    const d       = bezierPath(x1, y1, thickness, x2, y2, thickness);
    const pctStr  = ((link.value / meta.total) * 100).toFixed(1) + '%';
    const tipTxt  = `${escHtml(src.label)} → ${escHtml(tgt.label)}: ${link.value.toLocaleString()} B (${pctStr})`;
    return `    <path d="${d}" fill="${src.color || '#718096'}" fill-opacity="0.35" class="ribbon" data-tip="${tipTxt}"/>`;
  }).join('\n');

  // ── Pre-render node groups ─────────────────────────────────────────────────
  const nodesSvg = cols.map((col, colIdx) => col.map(n => {
    const node   = byId[n.id];
    const isLeft = colIdx === 0;
    const labelX = isLeft ? node._x - 8 : node._x + LBL_OFF;
    const anchor  = isLeft ? 'end' : 'start';
    const midY    = node._y + node._h / 2;
    const maxLen  = 22;
    const label   = n.label.length > maxLen ? n.label.slice(0, maxLen - 1) + '…' : n.label;
    const tipTxt  = `${escHtml(n.label)}: ${n.value.toLocaleString()} bytes (${((n.value / meta.total) * 100).toFixed(1)}%)`;
    const byteLbl = node._h > 24
      ? `    <text x="${labelX}" y="${midY + 7}" text-anchor="${anchor}" class="node-bytes">${fmtBytes(n.value)}</text>`
      : '';
    return `  <g class="node-group" data-tip="${tipTxt}">
    <rect x="${node._x}" y="${node._y}" width="${NODE_W}" height="${node._h}" fill="${n.color || '#718096'}" rx="3" class="node-rect"/>
    <text x="${labelX}" y="${midY - (node._h > 24 ? 7 : 0)}" text-anchor="${anchor}" class="node-label" dominant-baseline="${node._h > 24 ? 'auto' : 'middle'}">${escHtml(label)}</text>${byteLbl ? '\n' + byteLbl : ''}
  </g>`;
  }).join('\n')).join('\n');

  // ── Column header labels ───────────────────────────────────────────────────
  const colLabelSvg = ['MEMORY REGION', 'SECTION', 'MODULE'].map((lbl, i) =>
    `  <text x="${COL_X[i] + NODE_W / 2}" y="${PAD_T - 14}" text-anchor="middle" class="col-label">${lbl}</text>`
  ).join('\n');

  // ── Encode diagram data for the inline tooltip script ──────────────────────
  const diagramJson = JSON.stringify({ meta, columns, nodes, links, validation });

  const regions = nodes.filter(n => n.column === 'region');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(meta.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f4f5f7; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 32px 16px 48px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); width: 100%; max-width: 1100px; padding: 40px 48px 48px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 1.5rem; font-weight: 700; color: #1a202c; }
    .header .subtitle { font-size: 0.8rem; letter-spacing: 0.08em; color: #718096; margin-top: 4px; text-transform: uppercase; }
    .stats { display: flex; justify-content: center; gap: 40px; margin-bottom: 36px; flex-wrap: wrap; }
    .stat { text-align: center; }
    .stat .value { font-size: 1.6rem; font-weight: 700; color: #1a202c; }
    .stat .label { font-size: 0.72rem; letter-spacing: 0.07em; color: #718096; text-transform: uppercase; margin-top: 2px; }
    .stat .sublabel { font-size: 0.7rem; color: #a0aec0; margin-top: 1px; }
    .diagram-wrap { width: 100%; overflow-x: auto; }
    svg { display: block; margin: 0 auto; font-family: 'Inter', sans-serif; }
    .col-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; fill: #718096; text-transform: uppercase; }
    .node-rect { cursor: default; transition: opacity 0.15s; }
    .node-rect:hover { opacity: 0.85; }
    .node-label { font-size: 11px; fill: #2d3748; pointer-events: none; }
    .node-bytes { font-size: 10px; fill: #718096; pointer-events: none; }
    .ribbon { transition: fill-opacity 0.15s; cursor: default; }
    .ribbon:hover { fill-opacity: 0.6; }
    .tooltip { position: fixed; background: rgba(26,32,44,0.92); color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 12px; line-height: 1.5; pointer-events: none; display: none; z-index: 999; max-width: 240px; }
    .footer { margin-top: 24px; text-align: center; font-size: 0.72rem; color: #a0aec0; }
    .validation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #edf2f7; }
    .val-item { font-size: 0.75rem; color: #4a5568; }
    .val-item strong { color: #1a202c; }
  </style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>${escHtml(meta.title)}</h1>
    <div class="subtitle">${escHtml(meta.subtitle)}</div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="value">${fmtBytes(meta.total)}</div>
      <div class="label">Total</div>
    </div>
    <div class="stat" style="color:${regions.find(r=>r.id==='flash')?.color||'#4F86C6'}">
      <div class="value" style="color:${regions.find(r=>r.id==='flash')?.color||'#4F86C6'}">${fmtBytes(validation.flashTotal)}</div>
      <div class="label">Flash (ROM)</div>
      <div class="sublabel">${pct(validation.flashTotal, meta.total)}</div>
    </div>
    <div class="stat">
      <div class="value" style="color:${regions.find(r=>r.id==='ram')?.color||'#5BAD8F'}">${fmtBytes(validation.ramTotal)}</div>
      <div class="label">RAM</div>
      <div class="sublabel">${pct(validation.ramTotal, meta.total)}</div>
    </div>
  </div>

  <div class="diagram-wrap">
    <svg id="sankey" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}" style="width:100%">
${colLabelSvg}
${ribbonSvg}
${nodesSvg}
    </svg>
  </div>

  <div class="footer">
    Source: ${escHtml(meta.source)} &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}
  </div>
</div>

<div class="tooltip" id="tooltip"></div>

<script>
(function () {
  'use strict';
  // SVG is pre-rendered server-side. Only hover / tooltip behaviour runs here.
  const tooltip = document.getElementById('tooltip');
  document.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mousemove', e => {
      tooltip.innerHTML = el.dataset.tip;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });
    el.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });
})();
</script>
</body>
</html>`;
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtBytes(v) {
  if (v >= 1_048_576) return (v / 1_048_576).toFixed(1) + ' MB';
  if (v >= 1_024)     return (v / 1_024).toFixed(1) + ' KB';
  return v + ' B';
}

function pct(a, b) {
  if (!b) return '0%';
  return ((a / b) * 100).toFixed(1) + '%';
}

export { buildHtml };

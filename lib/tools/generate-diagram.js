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
// HTML generator
// ─────────────────────────────────────────────────────────────────────────────

function buildHtml(d) {
  const { meta, columns, nodes, links, validation } = d;

  // Column order is: region (0) → section (1) → module (2)
  const byColumn = col => nodes.filter(n => n.column === col);
  const regions  = byColumn('region');
  const sections = byColumn('section');
  const modules  = byColumn('module');

  // Encode diagram data for the inline script
  const diagramJson = JSON.stringify({ meta, columns, nodes, links, validation });

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
    body {
      font-family: 'Inter', sans-serif;
      background: #f4f5f7;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px 48px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      width: 100%;
      max-width: 1100px;
      padding: 40px 48px 48px;
    }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 1.5rem; font-weight: 700; color: #1a202c; }
    .header .subtitle { font-size: 0.8rem; letter-spacing: 0.08em; color: #718096; margin-top: 4px; text-transform: uppercase; }
    .stats {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-bottom: 36px;
      flex-wrap: wrap;
    }
    .stat { text-align: center; }
    .stat .value { font-size: 1.6rem; font-weight: 700; color: #1a202c; }
    .stat .label { font-size: 0.72rem; letter-spacing: 0.07em; color: #718096; text-transform: uppercase; margin-top: 2px; }
    .stat .sublabel { font-size: 0.7rem; color: #a0aec0; margin-top: 1px; }
    .diagram-wrap { width: 100%; overflow-x: auto; }
    svg { display: block; margin: 0 auto; font-family: 'Inter', sans-serif; }
    .col-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      fill: #718096;
      text-transform: uppercase;
    }
    .node-rect { cursor: default; transition: opacity 0.15s; }
    .node-rect:hover { opacity: 0.85; }
    .node-label { font-size: 11px; fill: #2d3748; pointer-events: none; }
    .node-bytes { font-size: 10px; fill: #718096; pointer-events: none; }
    .ribbon { fill-opacity: 0.35; transition: fill-opacity 0.15s; cursor: default; }
    .ribbon:hover { fill-opacity: 0.6; }
    .tooltip {
      position: fixed;
      background: rgba(26,32,44,0.92);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      line-height: 1.5;
      pointer-events: none;
      display: none;
      z-index: 999;
      max-width: 240px;
    }
    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 0.72rem;
      color: #a0aec0;
    }
    .validation-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #edf2f7;
    }
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
    <svg id="sankey" width="1004" height="0"></svg>
  </div>

  <div class="footer">
    Source: ${escHtml(meta.source)} &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}
  </div>
</div>

<div class="tooltip" id="tooltip"></div>

<script>
(function () {
  'use strict';

  const D = ${diagramJson};

  // ── Layout constants ───────────────────────────────────────────────────────
  const W       = 1004;
  const PAD_T   = 48;   // top padding (column labels)
  const PAD_B   = 16;
  const NODE_W  = 18;
  const GAP     = 8;    // min gap between nodes in same column
  const COL_X   = [60, 420, 780];  // x position of each column's left edge
  const LABEL_OFFSET = NODE_W + 8;

  // ── Node lookup ────────────────────────────────────────────────────────────
  const byId = {};
  D.nodes.forEach(n => { byId[n.id] = n; });

  // ── Separate into columns ─────────────────────────────────────────────────
  const cols = [
    D.nodes.filter(n => n.column === 'region'),
    D.nodes.filter(n => n.column === 'section'),
    D.nodes.filter(n => n.column === 'module'),
  ];

  // ── Compute total height needed ────────────────────────────────────────────
  function colSum(col) { return col.reduce((s, n) => s + n.value, 0); }

  const maxTotal = Math.max(...cols.map(colSum));
  const CONTENT_H = Math.max(500, cols.reduce((m, col) => {
    return Math.max(m, col.length * (GAP + 4));
  }, 0) + 120);

  // pixels per byte (scale against tallest column)
  const scale = (CONTENT_H - PAD_T - PAD_B) / maxTotal;

  // ── Assign y positions ─────────────────────────────────────────────────────
  // Each column is vertically centred relative to CONTENT_H
  function layoutColumn(col, colIdx) {
    const total   = colSum(col);
    const barH    = total * scale;
    const gaps    = (col.length - 1) * GAP;
    const usedH   = barH + gaps;
    let y = PAD_T + (CONTENT_H - PAD_T - PAD_B - usedH) / 2;

    col.forEach(n => {
      const h = Math.max(2, n.value * scale);
      n._x = COL_X[colIdx];
      n._y = y;
      n._h = h;
      n._linkOutOffset = 0;
      n._linkInOffset  = 0;
      y += h + GAP;
    });
  }

  cols.forEach(layoutColumn);

  const SVG_H = CONTENT_H + 20;

  // ── SVG setup ─────────────────────────────────────────────────────────────
  const svg = document.getElementById('sankey');
  svg.setAttribute('viewBox', \`0 0 \${W} \${SVG_H}\`);
  svg.setAttribute('height', SVG_H);
  svg.style.width = '100%';

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  // ── Column headers ────────────────────────────────────────────────────────
  const colLabels = ['MEMORY REGION', 'SECTION', 'MODULE'];
  colLabels.forEach((lbl, i) => {
    el('text', {
      x: COL_X[i] + NODE_W / 2, y: PAD_T - 14,
      'text-anchor': 'middle', class: 'col-label',
    }, svg).textContent = lbl;
  });

  // ── Draw ribbons (links) ──────────────────────────────────────────────────
  const tooltip = document.getElementById('tooltip');

  // Sort links so they draw bottom-to-top (improves ribbon readability)
  const sortedLinks = [...D.links].sort((a, b) => {
    const ay = (byId[a.from]?._y || 0) + (byId[a.to]?._y || 0);
    const by_ = (byId[b.from]?._y || 0) + (byId[b.to]?._y || 0);
    return ay - by_;
  });

  sortedLinks.forEach(link => {
    const src = byId[link.from];
    const tgt = byId[link.to];
    if (!src || !tgt) return;

    const thickness = Math.max(1, link.value * scale);

    const x1 = src._x + NODE_W;
    const y1 = src._y + src._linkOutOffset + thickness / 2;
    src._linkOutOffset += thickness;

    const x2 = tgt._x;
    const y2 = tgt._y + tgt._linkInOffset + thickness / 2;
    tgt._linkInOffset += thickness;

    const mx = (x1 + x2) / 2;

    // Bezier ribbon as a filled path
    const topPath = \`M\${x1},\${y1 - thickness/2} C\${mx},\${y1 - thickness/2} \${mx},\${y2 - thickness/2} \${x2},\${y2 - thickness/2}\`;
    const botPath = \`L\${x2},\${y2 + thickness/2} C\${mx},\${y2 + thickness/2} \${mx},\${y1 + thickness/2} \${x1},\${y1 + thickness/2} Z\`;

    const path = el('path', {
      d: topPath + botPath,
      fill: src.color || '#718096',
      class: 'ribbon',
    }, svg);

    // Tooltip
    const pctStr = ((link.value / D.meta.total) * 100).toFixed(1) + '%';
    const fmted = link.value.toLocaleString() + ' B';
    const tipHtml = \`<strong>\${src.label} → \${tgt.label}</strong><br/>\${fmted} (\${pctStr})\`;

    path.addEventListener('mousemove', e => {
      tooltip.innerHTML = tipHtml;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });
    path.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });

  // ── Draw nodes ────────────────────────────────────────────────────────────
  cols.forEach((col, colIdx) => {
    col.forEach(n => {
      const g = el('g', {}, svg);

      el('rect', {
        x: n._x, y: n._y, width: NODE_W, height: n._h,
        fill: n.color || '#718096',
        rx: 3,
        class: 'node-rect',
      }, g);

      const isLeft = colIdx === 0;
      const labelX = isLeft ? n._x - 8 : n._x + LABEL_OFFSET;
      const anchor  = isLeft ? 'end' : 'start';
      const midY    = n._y + n._h / 2;

      // Label (truncate long names)
      const maxLen = 22;
      const labelTxt = n.label.length > maxLen ? n.label.slice(0, maxLen - 1) + '…' : n.label;

      el('text', {
        x: labelX, y: midY - (n._h > 24 ? 7 : 0),
        'text-anchor': anchor,
        class: 'node-label',
        'dominant-baseline': n._h > 24 ? 'auto' : 'middle',
      }, g).textContent = labelTxt;

      if (n._h > 24) {
        el('text', {
          x: labelX, y: midY + 7,
          'text-anchor': anchor,
          class: 'node-bytes',
        }, g).textContent = fmtB(n.value);
      }

      // Tooltip on node hover
      const tipHtml = \`<strong>\${n.label}</strong><br/>\${n.value.toLocaleString()} bytes (\${((n.value/D.meta.total)*100).toFixed(1)}%)\`;
      g.style.cursor = 'default';
      g.addEventListener('mousemove', e => {
        tooltip.innerHTML = tipHtml;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top  = (e.clientY - 10) + 'px';
      });
      g.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtB(v) {
    if (v >= 1048576) return (v / 1048576).toFixed(1) + ' MB';
    if (v >= 1024)    return (v / 1024).toFixed(1) + ' KB';
    return v + ' B';
  }
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

#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// generate-diagram.js
//
// Generic CLI — accepts any valid schema JSON and writes a fully
// self-contained, interactive HTML Sankey diagram.
//
// Usage:
//   node lib/tools/generate-diagram.js <schema.json> [output.html]
//
// Examples:
//   node lib/tools/generate-diagram.js lib/gatherers/soccer/players/messi.json
//   node lib/tools/generate-diagram.js lib/gatherers/finance/salesforce-q1-fy27.json
//   node lib/tools/generate-diagram.js lib/gatherers/finance/salesforce-q1-fy27.json output/sf.html
//
// Schema detection (automatic, no hardcoded domain logic):
//   types[] + clubs[]   → butterfly layout  (soccer player JSON format)
//   columns[] + nodes[] → generic DAG layout (v2 schema format)
//
// Layout computation is delegated to lib/creator/layout.js:
//   computeLayout()  — butterfly entry point (player JSON)
//   bezierPath()     — SVG ribbon path formula (used by both modes)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename, extname, dirname } from 'path';
import { bezierPath, computeLayout } from '../creator/layout.js';

// ── CLI args ──────────────────────────────────────────────────────────────────
const [,, inputArg, outArg] = process.argv;

if (!inputArg) {
  console.error('Usage: node lib/tools/generate-diagram.js <schema.json> [output.html]');
  process.exit(1);
}

const inputPath = resolve(inputArg);
const stem      = basename(inputPath, extname(inputPath));
const outPath   = resolve(outArg ?? `output/${stem}.html`);

// ── Load schema ───────────────────────────────────────────────────────────────
let schema;
try {
  schema = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error(`✗ Could not read "${inputPath}": ${err.message}`);
  process.exit(1);
}

// ── Detect schema type ────────────────────────────────────────────────────────
function detectSchema(s) {
  if (Array.isArray(s.types) && Array.isArray(s.clubs))     return 'butterfly';
  if (Array.isArray(s.columns) && Array.isArray(s.nodes))   return 'generic';
  throw new Error(
    'Unrecognised schema format — expected either {types,clubs,links} or {columns,nodes,links}'
  );
}

let schemaType;
try {
  schemaType = detectSchema(schema);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}

// ── Generate HTML ─────────────────────────────────────────────────────────────
const html = schemaType === 'butterfly'
  ? buildButterflyHtml(schema)
  : buildGenericHtml(schema);

// ── Write output ──────────────────────────────────────────────────────────────
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf8');

// ── Success report ────────────────────────────────────────────────────────────
const unit      = schema.meta.unit ?? '';
const nodeCount = schemaType === 'butterfly'
  ? (schema.types?.length ?? 0) + (schema.clubs?.length ?? 0)
  : (schema.nodes?.length ?? 0);
const linkCount = schema.links?.length ?? 0;

console.log(`✓ Schema loaded: ${schema.meta.title}`);
console.log(`✓ Nodes: ${nodeCount} · Links: ${linkCount} · Unit: ${unit}`);
console.log(`✓ Diagram saved to: ${outPath}`);

// =============================================================================
// BUTTERFLY BUILDER  (player JSON format: types / clubs / links)
// Uses computeLayout() from lib/creator/layout.js for all positioning.
// =============================================================================

function buildButterflyHtml(schema) {
  // Delegate all layout computation to the creator layer
  const layout = computeLayout(schema);
  const { dimensions, leftNodes, rightNodes, midSegments, leftFlows, rightFlows, meta } = layout;
  const { W, H, NODE_W, MID_X, LEFT_X, RIGHT_X, MID_TOP, MID_BOT } = dimensions;
  const UNIT  = meta.unit ?? 'goals';
  const TOTAL = meta.total;

  // ── Pre-render flows (left: type colour, right: club colour) ─────────────
  const renderFlow = (f, side) => {
    const tipTxt = `${escHtml(f.typeId)} → ${escHtml(f.club)}: ${f.value} ${UNIT} (${Math.round(f.value / TOTAL * 100)}%)`;
    return `  <path d="${bezierPath(f.x1,f.y1,f.t1,f.x2,f.y2,f.t2)}"
    fill="${f.color}" class="flow" data-type-id="${f.typeId}" data-club-id="${f.club}"
    data-tip="${tipTxt}"/>`;
  };

  const leftFlowsSvg  = leftFlows .map(f => renderFlow(f, 'left')) .join('\n');
  const rightFlowsSvg = rightFlows.map(f => renderFlow(f, 'right')).join('\n');

  // ── Centre bar ────────────────────────────────────────────────────────────
  const midCenterY = (MID_TOP + MID_BOT) / 2;
  const midSvg = [
    ...midSegments.map(s =>
      `  <rect x="${MID_X}" y="${s.y}" width="${NODE_W}" height="${s.h}" fill="${s.color}" opacity="0.95"/>`
    ),
    `  <text x="${MID_X + NODE_W / 2}" y="${midCenterY + 7}"  text-anchor="middle" class="mid-total">${TOTAL}</text>`,
    `  <text x="${MID_X + NODE_W / 2}" y="${midCenterY + 22}" text-anchor="middle" class="mid-unit">${UNIT.toUpperCase()}</text>`,
  ].join('\n');

  // ── Left column nodes ─────────────────────────────────────────────────────
  const leftNodesSvg = leftNodes.map(n => `  <g class="node-grp" data-node-id="${n.id}" data-side="left">
    <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${n.h}" fill="${n.color}" rx="3" class="node-rect"/>
    <text x="${n.x-14}" y="${n.cy-10}" text-anchor="end" class="lbl-type" fill="${n.color}">${escHtml(n.label)}</text>
    <text x="${n.x-14}" y="${n.cy+9}"  text-anchor="end" class="lbl-value">${n.value}</text>
    <text x="${n.x-14}" y="${n.cy+24}" text-anchor="end" class="lbl-pct">${escHtml(n.pct ?? '')} of ${UNIT}</text>
  </g>`).join('\n');

  // ── Right column nodes ────────────────────────────────────────────────────
  const rightNodesSvg = rightNodes.map(n => `  <g class="node-grp" data-node-id="${n.id}" data-side="right">
    <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${n.h}" fill="${n.color}" rx="3" class="node-rect"/>
    <text x="${n.x+NODE_W+14}" y="${n.cy-9}"  text-anchor="start" class="lbl-club" style="fill:${n.tcolor||n.color}">${escHtml(n.label)}</text>
    <text x="${n.x+NODE_W+14}" y="${n.cy+6}"  text-anchor="start" class="lbl-years">${escHtml(n.years ?? '')}</text>
    <text x="${n.x+NODE_W+14}" y="${n.cy+23}" text-anchor="start" class="lbl-goals">${n.goals} ${UNIT}</text>
  </g>`).join('\n');

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendSvg = leftNodes.map((n, i) => `  <g>
    <rect x="${148 + i*150}" y="${H-22}" width="10" height="10" fill="${n.color}" rx="2"/>
    <text x="${163 + i*150}" y="${H-12}" class="legend-lbl">${escHtml(n.label)}</text>
  </g>`).join('\n');

  // ── SVG content ───────────────────────────────────────────────────────────
  const svgContent = `
  <rect width="${W}" height="${H}" fill="#fff" rx="20"/>
  <!-- Header -->
  <text x="${W/2}" y="22" text-anchor="middle" class="hdr-sub">${escHtml(meta.subtitle ?? 'CAREER STATISTICS · GOAL ANATOMY')}</text>
  <text x="${W/2}" y="50" text-anchor="middle" class="hdr-title">${escHtml(meta.title)}</text>
  <!-- Column labels -->
  <text x="${LEFT_X}"           y="72" text-anchor="middle" class="col-label">GOAL TYPE</text>
  <text x="${MID_X+NODE_W/2}"   y="72" text-anchor="middle" class="col-label">TOTAL</text>
  <text x="${RIGHT_X+NODE_W/2}" y="72" text-anchor="middle" class="col-label">CLUB / COUNTRY</text>
  <!-- Flows -->
${leftFlowsSvg}
${rightFlowsSvg}
  <!-- Centre bar -->
${midSvg}
  <!-- Nodes -->
${leftNodesSvg}
${rightNodesSvg}
  <!-- Legend -->
${legendSvg}`;

  const extraStyles = `
    .flow           { fill-opacity: 0.30; transition: fill-opacity 0.15s; cursor: default; }
    .hl-active .flow                     { fill-opacity: 0.04; }
    .hl-active .flow.hl-match            { fill-opacity: 0.65; }
    .node-rect      { cursor: pointer; }
    .lbl-type       { font-size:14px; font-weight:700; }
    .lbl-value      { font-size:22px; font-weight:800; fill:#1a202c; }
    .lbl-pct        { font-size:11px; fill:#b0bac8; }
    .lbl-club       { font-size:15px; font-weight:800; }
    .lbl-years      { font-size:11px; fill:#a0aec0; }
    .lbl-goals      { font-size:17px; font-weight:800; fill:#1a202c; }
    .mid-total      { font-size:22px; font-weight:900; fill:#1a202c; }
    .mid-unit       { font-size:9px;  font-weight:600; fill:#718096; letter-spacing:1px; }
    .hdr-sub        { font-size:10px; font-weight:600; fill:#a0aec0; letter-spacing:2px; }
    .hdr-title      { font-size:25px; font-weight:800; fill:#1a202c; }
    .col-label      { font-size:10px; font-weight:600; fill:#b0bac8; letter-spacing:1.5px; }
    .legend-lbl     { font-size:11px; fill:#718096; }`;

  const interactiveJs = `
  // Butterfly hover: highlight flows by node
  document.querySelectorAll('.node-grp').forEach(grp => {
    const id   = grp.dataset.nodeId;
    const side = grp.dataset.side;
    grp.addEventListener('mouseenter', () => {
      document.querySelectorAll('.flow').forEach(f => {
        const match = side === 'left' ? f.dataset.typeId === id : f.dataset.clubId === id;
        f.classList.toggle('hl-match', match);
      });
      document.body.classList.add('hl-active');
    });
    grp.addEventListener('mouseleave', () => {
      document.body.classList.remove('hl-active');
      document.querySelectorAll('.flow').forEach(f => f.classList.remove('hl-match'));
    });
  });
  // Tooltip on flows
  document.querySelectorAll('.flow').forEach(f => {
    f.addEventListener('mousemove', e => {
      tooltip.innerHTML = f.dataset.tip;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });
    f.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });`;

  return assembleHtml({
    title:       meta.title,
    source:      meta.source,
    svgWidth:    W,
    svgHeight:   H,
    svgContent,
    extraStyles,
    interactiveJs,
  });
}

// =============================================================================
// GENERIC BUILDER  (v2 schema: columns / nodes / links)
//
// Uses a topological BFS level-assignment so intra-column links (like the
// Salesforce breakdown where outcome nodes link to other outcome nodes) expand
// naturally into additional visual columns.
// bezierPath() from lib/creator/layout.js is used for all ribbon paths.
// =============================================================================

function buildGenericHtml(schema) {
  const { meta, nodes, links } = schema;
  const UNIT  = meta.unit ?? '';
  const TOTAL = meta.total;

  // ── 1. Build adjacency maps ───────────────────────────────────────────────
  const nodeById  = new Map(nodes.map(n => [n.id, n]));
  const outEdges  = new Map(nodes.map(n => [n.id, []]));
  const inEdges   = new Map(nodes.map(n => [n.id, []]));

  links.forEach(l => {
    const from = l.from ?? l.source;
    const to   = l.to   ?? l.target;
    outEdges.get(from)?.push({ ...l, from, to });
    inEdges .get(to)  ?.push({ ...l, from, to });
  });

  // ── 2. Topological level assignment (longest-path BFS) ───────────────────
  //    Nodes with no incoming links are level 0.
  //    Each node's level = max(predecessor levels) + 1.
  const level = new Map();
  const queue = [];

  nodes.forEach(n => {
    if (inEdges.get(n.id).length === 0) {
      level.set(n.id, 0);
      queue.push(n.id);
    }
  });

  // BFS — nodes may be visited multiple times (take the max)
  const visited = new Set();
  const bfsQ = [...queue];
  while (bfsQ.length) {
    const id  = bfsQ.shift();
    const lvl = level.get(id) ?? 0;
    outEdges.get(id).forEach(link => {
      const tid     = link.to;
      const newLvl  = lvl + 1;
      if (!level.has(tid) || level.get(tid) < newLvl) {
        level.set(tid, newLvl);
        bfsQ.push(tid);
      }
    });
  }

  // Fallback: any node still without a level (disconnected) gets level 0
  nodes.forEach(n => { if (!level.has(n.id)) level.set(n.id, 0); });

  // ── 3. Group nodes by level ───────────────────────────────────────────────
  const maxLevel = Math.max(...level.values());
  const byLevel  = Array.from({ length: maxLevel + 1 }, () => []);
  nodes.forEach(n => byLevel[level.get(n.id)].push(n));

  // ── 4. Canvas dimensions ──────────────────────────────────────────────────
  const numCols   = maxLevel + 1;
  const NODE_W    = 18;
  const PAD_T     = 80;   // extra room for title + subtitle + column labels
  const PAD_B     = 60;
  const PAD_L     = 160;   // left label space
  const PAD_R     = 220;   // right label space
  const GAP       = 8;
  const COL_STEP  = Math.max(200, Math.round((960 - PAD_L - PAD_R) / Math.max(numCols - 1, 1)));
  const SVG_W     = PAD_L + (numCols - 1) * COL_STEP + NODE_W + PAD_R;
  const AVAIL_H   = 480;
  const SVG_H     = PAD_T + AVAIL_H + PAD_B;

  // ── 5. Position nodes (per-level proportional scaling) ───────────────────
  const posMap = new Map();

  byLevel.forEach((levelNodes, lvl) => {
    if (!levelNodes.length) return;
    const xLeft   = PAD_L + lvl * COL_STEP;
    const lvlSum  = levelNodes.reduce((s, n) => s + n.value, 0);
    const usedGap = GAP * (levelNodes.length - 1);
    const avail   = AVAIL_H - usedGap;
    let y = PAD_T;

    levelNodes.forEach(n => {
      const h = Math.max(2, lvlSum > 0 ? (n.value / lvlSum) * avail : avail / levelNodes.length);
      posMap.set(n.id, { ...n, x: xLeft, y, h, cy: y + h / 2 });
      y += h + GAP;
    });
  });

  // ── 6. Compute link positions (center-anchored fan per node) ─────────────
  // Sort descending so the dominant ribbon is placed first in each bundle.
  const sortedLinks = [...links].sort((a, b) => b.value - a.value);

  // Pre-calculate total outgoing / incoming ribbon thickness per node.
  const srcTotalThick = new Map(nodes.map(n => [n.id, 0]));
  const tgtTotalThick = new Map(nodes.map(n => [n.id, 0]));
  sortedLinks.forEach(l => {
    const fromId = l.from ?? l.source;
    const toId   = l.to   ?? l.target;
    const src    = posMap.get(fromId);
    const tgt    = posMap.get(toId);
    if (!src || !tgt) return;
    const sh = src.value > 0 ? (l.value / src.value) * src.h : 0;
    const th = tgt.value > 0 ? (l.value / tgt.value) * tgt.h : 0;
    srcTotalThick.set(fromId, (srcTotalThick.get(fromId) ?? 0) + sh);
    tgtTotalThick.set(toId,   (tgtTotalThick.get(toId)   ?? 0) + th);
  });

  // Cursors are offsets from node.cy. Starting at −totalThick/2 centers the
  // entire ribbon bundle on the node's vertical midpoint.
  const srcCursor = new Map([...posMap.entries()].map(([id, n]) =>
    [id, -(srcTotalThick.get(id) ?? 0) / 2]
  ));
  const tgtCursor = new Map([...posMap.entries()].map(([id, n]) =>
    [id, -(tgtTotalThick.get(id) ?? 0) / 2]
  ));

  const posLinks = sortedLinks.map(l => {
    const fromId = l.from ?? l.source;
    const toId   = l.to   ?? l.target;
    const src    = posMap.get(fromId);
    const tgt    = posMap.get(toId);
    if (!src || !tgt) return null;

    const sh  = src.value > 0 ? (l.value / src.value) * src.h : 0;
    const th  = tgt.value > 0 ? (l.value / tgt.value) * tgt.h : 0;
    // sy / ty are absolute y positions (offsets from node centre).
    const sy  = src.cy + (srcCursor.get(fromId) ?? 0);
    const ty  = tgt.cy + (tgtCursor.get(toId)   ?? 0);

    srcCursor.set(fromId, (srcCursor.get(fromId) ?? 0) + sh);
    tgtCursor.set(toId,   (tgtCursor.get(toId)   ?? 0) + th);

    return {
      fromId, toId,
      value:  l.value,
      color:  l.color ?? src.color ?? '#718096',
      fromLabel: src.label,
      toLabel:   tgt.label,
      x1: src.x + NODE_W, y1: sy + sh / 2, t1: sh,
      x2: tgt.x,          y2: ty + th / 2, t2: th,
    };
  }).filter(Boolean);

  // ── 7. Pre-render SVG elements ────────────────────────────────────────────
  const flowsSvg = posLinks.map(f => {
    const pct    = TOTAL > 0 ? Math.round(f.value / TOTAL * 100) : 0;
    const tipTxt = `${escHtml(f.fromLabel)} → ${escHtml(f.toLabel)}: ${f.value} ${UNIT} (${pct}%)`;
    return `  <path d="${bezierPath(f.x1,f.y1,f.t1,f.x2,f.y2,f.t2)}"
    fill="${f.color}" class="flow" data-from-id="${f.fromId}" data-to-id="${f.toId}"
    data-tip="${tipTxt}"/>`;
  }).join('\n');

  const nodesSvg = [...posMap.values()].map(n => {
    const isFirst = level.get(n.id) === 0;
    const isLast  = level.get(n.id) === maxLevel;
    const labelX  = isFirst ? n.x - 10 : n.x + NODE_W + 10;
    const anchor  = isFirst ? 'end' : 'start';
    const showMeta = n.meta && n.h > 22;
    const midY    = n.cy;
    const tipTxt  = `${escHtml(n.label)}: ${n.value} ${UNIT} (${TOTAL > 0 ? Math.round(n.value/TOTAL*100) : 0}%)`;
    return `  <g class="node-grp" data-node-id="${n.id}" data-tip="${tipTxt}">
    <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${n.h}" fill="${n.color||'#718096'}" rx="3" class="node-rect"/>
    ${n.h >= 14 ? `<text x="${labelX}" y="${showMeta ? midY - 6 : midY + 4}" text-anchor="${anchor}" class="node-lbl">${escHtml(n.label)}</text>` : ''}
    ${showMeta  ? `<text x="${labelX}" y="${midY + 10}" text-anchor="${anchor}" class="node-meta">${escHtml(String(n.meta))}</text>` : ''}
    ${n.h >= 22 ? `<text x="${labelX}" y="${showMeta ? midY + 22 : midY + 18}" text-anchor="${anchor}" class="node-val">${n.value} ${UNIT}</text>` : ''}
  </g>`;
  }).join('\n');

  // Column headers (use schema column labels where available, else "Level N")
  const colLabels = schema.columns ?? [];
  const colHeadersSvg = byLevel.map((_, lvl) => {
    const colDef = colLabels.find(c => {
      // Match by index if defined, otherwise by order
      return c.index === lvl || (!('index' in c) && colLabels.indexOf(c) === lvl);
    });
    const lbl = colDef?.label ?? `Level ${lvl}`;
    const x   = PAD_L + lvl * COL_STEP + NODE_W / 2;
    return `  <text x="${x}" y="${PAD_T - 14}" text-anchor="middle" class="col-label">${escHtml(lbl)}</text>`;
  }).join('\n');

  const svgContent = `
  <rect width="${SVG_W}" height="${SVG_H}" fill="#fff" rx="16"/>
  <!-- Header -->
  <text x="${SVG_W/2}" y="26" text-anchor="middle" class="hdr-title">${escHtml(meta.title)}</text>
  <text x="${SVG_W/2}" y="42" text-anchor="middle" class="hdr-sub">${escHtml(meta.subtitle ?? '')}</text>
  <!-- Column labels -->
${colHeadersSvg}
  <!-- Flows -->
${flowsSvg}
  <!-- Nodes -->
${nodesSvg}`;

  const extraStyles = `
    .flow         { fill-opacity: 0.30; transition: fill-opacity 0.15s; cursor: default; }
    .hl-active .flow                  { fill-opacity: 0.04; }
    .hl-active .flow.hl-match         { fill-opacity: 0.65; }
    .node-rect    { cursor: pointer; }
    .node-lbl     { font-size:12px; font-weight:700; fill:#1a202c; }
    .node-meta    { font-size:10px; fill:#718096; }
    .node-val     { font-size:11px; font-weight:600; fill:#4a5568; }
    .hdr-title    { font-size:20px; font-weight:800; fill:#1a202c; }
    .hdr-sub      { font-size:10px; font-weight:500; fill:#a0aec0; letter-spacing:1px; }
    .col-label    { font-size:10px; font-weight:600; fill:#718096; letter-spacing:1.5px; text-transform:uppercase; }`;

  const interactiveJs = `
  // Generic hover: highlight flows connected to hovered node
  document.querySelectorAll('.node-grp').forEach(grp => {
    const id = grp.dataset.nodeId;
    grp.addEventListener('mouseenter', () => {
      document.querySelectorAll('.flow').forEach(f => {
        const match = f.dataset.fromId === id || f.dataset.toId === id;
        f.classList.toggle('hl-match', match);
      });
      document.body.classList.add('hl-active');
      tooltip.innerHTML = grp.dataset.tip;
      tooltip.style.display = 'block';
    });
    grp.addEventListener('mousemove', e => {
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });
    grp.addEventListener('mouseleave', () => {
      document.body.classList.remove('hl-active');
      document.querySelectorAll('.flow').forEach(f => f.classList.remove('hl-match'));
      tooltip.style.display = 'none';
    });
  });
  // Tooltip on flows
  document.querySelectorAll('.flow').forEach(f => {
    f.addEventListener('mousemove', e => {
      tooltip.innerHTML = f.dataset.tip;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });
    f.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });`;

  return assembleHtml({
    title:       meta.title,
    source:      meta.source,
    svgWidth:    SVG_W,
    svgHeight:   SVG_H,
    svgContent,
    extraStyles,
    interactiveJs,
  });
}

// =============================================================================
// HTML ASSEMBLY  — shared wrapper for both modes
// =============================================================================

function assembleHtml({ title, source, svgWidth, svgHeight, svgContent, extraStyles, interactiveJs }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
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
      position: relative;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 2px 40px rgba(0,0,0,0.09);
      width: 100%;
      max-width: ${svgWidth}px;
    }
    svg {
      display: block;
      width: 100%;
      font-family: 'Inter', sans-serif;
      overflow: visible;
    }
    .footer {
      margin-top: 14px;
      font-size: 10px;
      color: #c0c8d8;
      text-align: center;
    }
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
      max-width: 260px;
      white-space: nowrap;
    }
${extraStyles}
  </style>
</head>
<body>
  <div class="card">
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
${svgContent}
    </svg>
  </div>
${source ? `  <div class="footer">Data: ${escHtml(source)}</div>` : ''}

  <div class="tooltip" id="tooltip"></div>

  <script>
  (function () {
    'use strict';
    const tooltip = document.getElementById('tooltip');
${interactiveJs}
  })();
  </script>
</body>
</html>`;
}

// =============================================================================
// UTILITIES
// =============================================================================

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

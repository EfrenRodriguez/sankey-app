/**
 * lib/creator/layout.js
 *
 * Layout engine — converts diagram data into pixel-positioned layout
 * ready for SankeyRenderer.jsx.
 *
 * Primary export (player JSON schema):
 *   computeLayout(schema, options)
 *     Takes a player JSON object { meta, types, clubs, links } and returns
 *     everything SankeyRenderer needs to render the diagram.
 *     Pure — no React, no DOM, fully testable with plain Node.js.
 *
 * Secondary exports:
 *   bezierPath(x1,y1,t1,x2,y2,t2) — SVG path string generator (alias: ribbon)
 *   computeButterfly(opts)          — domain-agnostic butterfly layout engine
 *   computeLayoutGeneric(diagram)   — generic v2 schema layout (columns/nodes/links)
 *
 * Canvas constants match PROJECT.md "Key layout constants":
 *   W=960, H=540, LEFT_X=155, MID_X=480, RIGHT_X=810, NODE_W=16,
 *   PAD_T=88, PAD_B=44, L_GAP=20, R_GAP=28, MID_H=AVAIL×0.60
 */

// ---------------------------------------------------------------------------
// Canvas constants  (pixel-exact match to all player components)
// ---------------------------------------------------------------------------

export const W        = 960;
export const H        = 540;
export const LEFT_X   = 155;    // left-column node bar — left edge x
export const MID_X    = 480;    // centre bar — left edge x
export const RIGHT_X  = 810;    // right-column node bar — left edge x
export const NODE_W   = 16;     // node bar width (px)
export const PAD_T    = 88;     // top padding  (title + column labels)
export const PAD_B    = 44;     // bottom padding (legend)
export const AVAIL    = H - PAD_T - PAD_B;   // 408 px usable height
export const MID_H    = AVAIL * 0.60;         // 244.8 px centre bar height
export const MID_TOP  = PAD_T + (AVAIL - MID_H) / 2;
export const MID_BOT  = MID_TOP + MID_H;
export const L_GAP    = 20;     // gap between consecutive left nodes
export const R_GAP    = 28;     // gap between consecutive right nodes

/**
 * Legacy CANVAS object — prefer the named exports above.
 * PADDING is kept for backwards compatibility only.
 */
export const CANVAS = {
  W, H, LEFT_X, MID_X, RIGHT_X, NODE_W,
  PAD_T, PAD_B, L_GAP, R_GAP,
  PADDING: PAD_T,           // backwards-compat alias (was 48, now correct)
  get AVAIL() { return AVAIL; },
  get MID_H()  { return MID_H;  },
};

// ---------------------------------------------------------------------------
// Bezier ribbon path helper
// ---------------------------------------------------------------------------

/**
 * Build a filled bezier ribbon SVG path between two points.
 * Coordinates are the *centre* of the ribbon; thickness supplied per end.
 *
 * @param {number} x1   x at source end
 * @param {number} y1   y centre at source end
 * @param {number} t1   ribbon thickness at source end
 * @param {number} x2   x at target end
 * @param {number} y2   y centre at target end
 * @param {number} t2   ribbon thickness at target end
 * @returns {string}    SVG path `d` attribute string
 */
export function bezierPath(x1, y1, t1, x2, y2, t2) {
  const cx = (x1 + x2) / 2;
  return [
    `M${x1},${y1 - t1 / 2}`,
    `C${cx},${y1 - t1 / 2} ${cx},${y2 - t2 / 2} ${x2},${y2 - t2 / 2}`,
    `L${x2},${y2 + t2 / 2}`,
    `C${cx},${y2 + t2 / 2} ${cx},${y1 + t1 / 2} ${x1},${y1 + t1 / 2}`,
    'Z',
  ].join(' ');
}

/** Backwards-compatible alias for bezierPath. */
export const ribbon = bezierPath;

// ---------------------------------------------------------------------------
// computeLayout — primary entry point for player JSON schema
// ---------------------------------------------------------------------------

/**
 * Compute the full butterfly layout from a player JSON schema object.
 * This is the function called by SankeyRenderer — pure computation, no React.
 *
 * @param {object} schema — player JSON { meta, types, clubs, links }
 * @param {{ width?: number, height?: number, theme?: string }} [options]
 * @returns {{
 *   dimensions:  { W, H, PAD_TOP, USABLE_H, NODE_W, LEFT_X, MID_X, RIGHT_X, MID_TOP, MID_BOT },
 *   leftNodes:   Array<{ id, label, color, value, total, pct, x, y, h, cy }>,
 *   rightNodes:  Array<{ id, label, color, tcolor, goals, years, x, y, h, cy }>,
 *   midSegments: Array<{ id, typeId, color, y, h, cy }>,
 *   leftFlows:   Array<{ id, typeId, club, value, color, x1,y1,t1,x2,y2,t2 }>,
 *   rightFlows:  Array<{ id, typeId, club, value, color, x1,y1,t1,x2,y2,t2 }>,
 *   gradients:   Array,
 *   meta:        object,
 * }}
 */
export function computeLayout(schema, options = {}) {
  const { meta, types, clubs, links } = schema;
  const total = meta.total;

  // ── Map player domain schema → generic butterfly terms ────────────────────
  // Keep domain-specific field aliases alongside the generic 'value' field
  // so the butterfly engine can size nodes, and SankeyRenderer gets full data.
  const lNodes = types.map(t => ({
    id:    t.id,
    label: t.label,
    value: t.total,   // butterfly uses .value for proportional sizing
    total: t.total,   // domain alias
    pct:   t.pct,
    color: t.color,
  }));

  const rNodes = clubs.map(c => ({
    id:     c.name,
    label:  c.name,
    value:  c.goals,  // butterfly uses .value for proportional sizing
    goals:  c.goals,  // domain alias
    color:  c.color,
    tcolor: c.tcolor,
    years:  c.years,
  }));

  const flowLinks = links.map(l => ({
    leftId:  l.type,
    rightId: l.club,
    value:   l.value,
  }));

  // ── Run butterfly engine ──────────────────────────────────────────────────
  const butterfly = computeButterfly({
    leftNodes:  lNodes,
    rightNodes: rNodes,
    links:      flowLinks,
    total,
  });

  // ── Remap to public API names ─────────────────────────────────────────────
  // typeId / club replace leftId / rightId; midSegments expose typeId alias.
  const midSegments = butterfly.midSegments.map(s => ({ ...s, typeId: s.id }));
  const leftFlows   = butterfly.flows.leftFlows.map(f => ({
    ...f, typeId: f.leftId, club: f.rightId,
  }));
  const rightFlows  = butterfly.flows.rightFlows.map(f => ({
    ...f, typeId: f.leftId, club: f.rightId,
  }));

  return {
    dimensions: {
      W,
      H,
      PAD_TOP:  PAD_T,
      USABLE_H: AVAIL,
      NODE_W,
      LEFT_X,
      MID_X,
      RIGHT_X,
      MID_TOP,
      MID_BOT,
    },
    leftNodes:  butterfly.typeNodes,   // have: id,label,color,value,total,pct,x,y,h,cy
    rightNodes: butterfly.clubNodes,   // have: id,label,color,tcolor,goals,years,x,y,h,cy
    midSegments,
    leftFlows,
    rightFlows,
    gradients: [],  // reserved — no gradient support yet
    meta,
  };
}

// ---------------------------------------------------------------------------
// computeButterfly  — domain-agnostic butterfly-flow layout engine
// ---------------------------------------------------------------------------

/**
 * Compute a pixel-exact butterfly layout from generic input arrays.
 *
 * Flow pattern:  leftNodes → centreBar → rightNodes
 *
 * Each link produces TWO ribbon objects: left-node→centre (left color)
 * and centre→right-node (right color). A cursor per node prevents overlaps.
 *
 * @param {object} opts
 * @param {Array<{ id, label, value, color, [key]: any }>} opts.leftNodes
 * @param {Array<{ id, label, value, color, [key]: any }>} opts.rightNodes
 * @param {Array<{ leftId, rightId, value }>} opts.links
 * @param {number} opts.total — grand total (denominator for all proportions)
 * @returns {{ typeNodes, clubNodes, midSegments, flows, dimensions }}
 */
export function computeButterfly({ leftNodes, rightNodes, links, total }) {
  // ── Centre bar segments ──────────────────────────────────────────────────
  let midY = MID_TOP;
  const midSegments = leftNodes.map(n => {
    const h   = (n.value / total) * MID_H;
    const seg = { id: n.id, color: n.color, y: midY, h, cy: midY + h / 2 };
    midY += h;
    return seg;
  });

  // ── Left column nodes — heights ×0.68 scale, min 6 px, vertically centred ─
  const lHeights = leftNodes.map(n => Math.max(6, (n.value / total) * (AVAIL * 0.68)));
  const lTotalH  = lHeights.reduce((s, h) => s + h, 0) + L_GAP * (leftNodes.length - 1);
  let lY = PAD_T + (AVAIL - lTotalH) / 2;

  const typeNodes = leftNodes.map((n, i) => {
    const h    = lHeights[i];
    const node = { ...n, x: LEFT_X, y: lY, h, cy: lY + h / 2 };
    lY += h + L_GAP;
    return node;
  });

  // ── Right column nodes — heights ×0.72 scale, min 16 px, vertically centred ─
  const rHeights = rightNodes.map(n => Math.max(16, (n.value / total) * (AVAIL * 0.72)));
  const rTotalH  = rHeights.reduce((s, h) => s + h, 0) + R_GAP * (rightNodes.length - 1);
  let rY = PAD_T + (AVAIL - rTotalH) / 2;

  const clubNodes = rightNodes.map((n, i) => {
    const h    = rHeights[i];
    const node = { ...n, x: RIGHT_X, y: rY, h, cy: rY + h / 2 };
    rY += h + R_GAP;
    return node;
  });

  // ── Ribbon cursors — track next ribbon start per node ────────────────────
  const lCursor = {};
  typeNodes  .forEach(n => { lCursor[n.id] = n.y; });
  const mCursor = {};
  midSegments.forEach(s => { mCursor[s.id] = s.y; });
  const rCursor = {};
  clubNodes  .forEach(n => { rCursor[n.id] = n.y; });

  // ── Build flows ──────────────────────────────────────────────────────────
  const leftFlows  = [];
  const rightFlows = [];
  let fid = 0;

  leftNodes.forEach(leftNode => {
    const nodeLinks = links.filter(l => l.leftId === leftNode.id);
    const lNode     = typeNodes  .find(n => n.id === leftNode.id);
    const midSeg    = midSegments.find(s => s.id === leftNode.id);
    if (!lNode || !midSeg) return;

    nodeLinks.forEach(link => {
      if (link.value <= 0) return;
      const rNode = clubNodes.find(n => n.id === link.rightId);
      if (!rNode) return;

      // Ribbon thickness per side (exact formulas from hand-coded components)
      const tL = Math.max(1.5, (link.value / total) * (AVAIL * 0.68)); // left scale
      const tM = (link.value / leftNode.value) * midSeg.h;              // mid scale
      const tR = Math.max(1.5, (link.value / total) * (AVAIL * 0.72)); // right scale

      const lCy  = lCursor[leftNode.id]  + tL / 2;
      const mCyL = mCursor[leftNode.id]  + tM / 2;
      const rCy  = rCursor[link.rightId] + tR / 2;

      leftFlows.push({
        id: `lf${fid}`, leftId: leftNode.id, rightId: link.rightId,
        value: link.value, color: leftNode.color,
        x1: lNode.x, y1: lCy,  t1: tL,
        x2: MID_X,   y2: mCyL, t2: tM,
      });
      rightFlows.push({
        id: `rf${fid}`, leftId: leftNode.id, rightId: link.rightId,
        value: link.value, color: rNode.color,
        x1: MID_X + NODE_W, y1: mCyL, t1: tM,
        x2: rNode.x,        y2: rCy,  t2: tR,
      });

      fid++;
      lCursor[leftNode.id]  += tL;
      mCursor[leftNode.id]  += tM;
      rCursor[link.rightId] += tR;
    });
  });

  return {
    typeNodes,
    clubNodes,
    midSegments,
    flows: { leftFlows, rightFlows },
    dimensions: {
      W, H, PAD_T, PAD_B, AVAIL, NODE_W,
      LEFT_X, MID_X, RIGHT_X,
      MID_H, MID_TOP, MID_BOT,
      L_GAP, R_GAP,
    },
  };
}

// ---------------------------------------------------------------------------
// computeLayoutGeneric — generic v2 schema layout (columns/nodes/links)
// ---------------------------------------------------------------------------

/**
 * Assign pixel positions to nodes in one column.
 * @private
 */
function _layoutColumn(nodes, total, gap, xPos) {
  if (!nodes.length) return [];
  const availHeight = AVAIL - gap * (nodes.length - 1);
  let cursor = PAD_T;
  return nodes.map(node => {
    const h = Math.max(1, (node.value / total) * availHeight);
    const positioned = {
      ...node,
      overlap: node.overlap ?? false,
      x:       xPos,
      y:       cursor,
      width:   NODE_W,
      height:  h,
    };
    cursor += h + gap;
    return positioned;
  });
}

/**
 * Generic v2 schema layout (columns[], nodes[], links[{from/source, to/target}]).
 *
 * @param {object} diagram — SankeyDiagram v2 object
 * @returns {{ nodes: Array, links: Array, canvas: object }}
 */
export function computeLayoutGeneric(diagram) {
  const { meta, columns, nodes, links } = diagram;
  const total = meta.total;

  if (columns.length < 2) {
    throw new Error('[layout] Diagram must have at least 2 columns.');
  }

  const byColumn = new Map();
  for (const col of columns) byColumn.set(col.id, []);
  for (const node of nodes) {
    if (!node.overlap) byColumn.get(node.column)?.push(node);
  }

  const colIds = columns.map(c => c.id);

  const xPositions = new Map();
  colIds.forEach((id, i) => {
    if (colIds.length === 2) {
      xPositions.set(id, i === 0 ? LEFT_X : RIGHT_X);
    } else {
      const step = (RIGHT_X - LEFT_X) / (colIds.length - 1);
      xPositions.set(id, LEFT_X + i * step);
    }
  });

  const positionedByCol = new Map();
  for (const col of columns) {
    const colNodes = byColumn.get(col.id) ?? [];
    const gap      = col.id === colIds[0] ? L_GAP : R_GAP;
    positionedByCol.set(
      col.id,
      _layoutColumn(colNodes, total, gap, xPositions.get(col.id))
    );
  }

  const positionedNodes = colIds.flatMap(id => positionedByCol.get(id) ?? []);
  const nodeMap         = new Map(positionedNodes.map(n => [n.id, n]));
  const sourceOffset    = new Map(positionedNodes.map(n => [n.id, 0]));
  const targetOffset    = new Map(positionedNodes.map(n => [n.id, 0]));

  const positionedLinks = links.map(link => {
    const srcId = link.from   ?? link.source;
    const tgtId = link.to     ?? link.target;
    const src   = nodeMap.get(srcId);
    const tgt   = nodeMap.get(tgtId);
    if (!src || !tgt) {
      throw new Error(`[layout] Link references unknown node: ${srcId} → ${tgtId}`);
    }

    const sh = (link.value / src.value) * src.height;
    const th = (link.value / tgt.value) * tgt.height;
    const sy = sourceOffset.get(srcId) ?? 0;
    const ty = targetOffset.get(tgtId) ?? 0;

    sourceOffset.set(srcId, sy + sh);
    targetOffset.set(tgtId, ty + th);

    return {
      source: srcId, target: tgtId, value: link.value,
      sy: src.y + sy, ty: tgt.y + ty, sh, th,
      color: link.color,
    };
  });

  return { nodes: positionedNodes, links: positionedLinks, canvas: CANVAS };
}

/**
 * lib/creator/layout.js
 *
 * Layout engine — converts diagram data into pixel-positioned layout
 * ready for SankeyRenderer.jsx.
 *
 * Exports two layout modes:
 *
 *   computeButterfly()  — the butterfly-flow layout used in all soccer
 *     player diagrams (leftNodes → centreBar → rightNodes).
 *     Pixel-identical to the hand-coded player components.
 *     Domain-agnostic: no references to 'goals', 'clubs', 'types', etc.
 *
 *   computeLayout()     — generic bidirectional Sankey for v2 schema
 *     objects (columns[], nodes[], links[{from/source, to/target}]).
 *
 * Canvas constants match PROJECT.md "Key layout constants" and the
 * values hardcoded in every player component:
 *   W=960, H=540, LEFT_X=155, MID_X=480, RIGHT_X=810, NODE_W=16,
 *   PAD_T=88, PAD_B=44, L_GAP=20, R_GAP=28, MID_H=AVAIL*0.60
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
 * Identical to the ribbon() function in every player component.
 *
 * @param {number} x1   x at source end
 * @param {number} y1   y centre at source end
 * @param {number} t1   ribbon thickness at source end
 * @param {number} x2   x at target end
 * @param {number} y2   y centre at target end
 * @param {number} t2   ribbon thickness at target end
 * @returns {string}    SVG path `d` attribute string
 */
export function ribbon(x1, y1, t1, x2, y2, t2) {
  const cx = (x1 + x2) / 2;
  return [
    `M${x1},${y1 - t1 / 2}`,
    `C${cx},${y1 - t1 / 2} ${cx},${y2 - t2 / 2} ${x2},${y2 - t2 / 2}`,
    `L${x2},${y2 + t2 / 2}`,
    `C${cx},${y2 + t2 / 2} ${cx},${y1 + t1 / 2} ${x1},${y1 + t1 / 2}`,
    'Z',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// computeButterfly  — butterfly-flow layout engine
// ---------------------------------------------------------------------------

/**
 * Compute a pixel-exact butterfly layout from generic input arrays.
 *
 * Flow pattern:  leftNodes → centreBar → rightNodes
 *
 * Each link between a left node and a right node produces TWO ribbon
 * objects: one from the left node to the centre bar (coloured with
 * the left node's colour) and one from the centre bar to the right
 * node (coloured with the right node's colour).
 *
 * A running cursor per node tracks where the next ribbon starts,
 * preventing overlaps — identical to buildFlows() in the player components.
 *
 * Domain-agnostic: parameter names use generic terms only.
 *
 * @param {object} opts
 * @param {Array<{
 *   id:     string,
 *   label:  string,
 *   value:  number,
 *   color:  string,
 *   pct?:   string,
 *   [key]:  any,
 * }>} opts.leftNodes
 *   Left-column nodes in display order (top → bottom).
 *   `value` is used as the size denominator on the left side.
 *
 * @param {Array<{
 *   id:      string,
 *   label:   string,
 *   value:   number,
 *   color:   string,
 *   tcolor?: string,
 *   meta?:   string,
 *   [key]:   any,
 * }>} opts.rightNodes
 *   Right-column nodes in display order (top → bottom).
 *
 * @param {Array<{
 *   leftId:  string,
 *   rightId: string,
 *   value:   number,
 * }>} opts.links
 *   Flows connecting a left node to a right node. Processed in
 *   left-node order (same as TYPES.forEach in player components).
 *
 * @param {number} opts.total
 *   Grand total — the denominator used for proportional sizing of
 *   both columns and the centre bar (= meta.total).
 *
 * @returns {{
 *   typeNodes:   Array,   positioned left nodes  { id, x, y, h, cy, color, … }
 *   clubNodes:   Array,   positioned right nodes { id, x, y, h, cy, color, … }
 *   midSegments: Array,   centre bar segments    { id, color, y, h, cy }
 *   flows:       { leftFlows: Array, rightFlows: Array }
 *   dimensions:  object   all canvas constants
 * }}
 */
export function computeButterfly({ leftNodes, rightNodes, links, total }) {
  // ── Centre bar segments ──────────────────────────────────────────────────
  // One segment per left node, stacked top-to-bottom inside MID_TOP…MID_BOT.
  let midY = MID_TOP;
  const midSegments = leftNodes.map(n => {
    const h   = (n.value / total) * MID_H;
    const seg = { id: n.id, color: n.color, y: midY, h, cy: midY + h / 2 };
    midY += h;
    return seg;
  });

  // ── Left column nodes ────────────────────────────────────────────────────
  // Heights proportional to value (×0.68 scale), min 6 px, vertically centred.
  const lHeights = leftNodes.map(n =>
    Math.max(6, (n.value / total) * (AVAIL * 0.68))
  );
  const lTotalH = lHeights.reduce((s, h) => s + h, 0) + L_GAP * (leftNodes.length - 1);
  let lY = PAD_T + (AVAIL - lTotalH) / 2;

  const typeNodes = leftNodes.map((n, i) => {
    const h    = lHeights[i];
    const node = { ...n, x: LEFT_X, y: lY, h, cy: lY + h / 2 };
    lY += h + L_GAP;
    return node;
  });

  // ── Right column nodes ───────────────────────────────────────────────────
  // Heights proportional to value (×0.72 scale), min 16 px, vertically centred.
  const rHeights = rightNodes.map(n =>
    Math.max(16, (n.value / total) * (AVAIL * 0.72))
  );
  const rTotalH = rHeights.reduce((s, h) => s + h, 0) + R_GAP * (rightNodes.length - 1);
  let rY = PAD_T + (AVAIL - rTotalH) / 2;

  const clubNodes = rightNodes.map((n, i) => {
    const h    = rHeights[i];
    const node = { ...n, x: RIGHT_X, y: rY, h, cy: rY + h / 2 };
    rY += h + R_GAP;
    return node;
  });

  // ── Ribbon cursors ───────────────────────────────────────────────────────
  // Each cursor starts at the node's top y and advances by ribbon thickness.
  const lCursor = {};
  typeNodes.forEach(n  => { lCursor[n.id]  = n.y; });
  const mCursor = {};
  midSegments.forEach(s => { mCursor[s.id]  = s.y; });
  const rCursor = {};
  clubNodes.forEach(n  => { rCursor[n.id]  = n.y; });

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

      // Ribbon thickness — each side uses its own scale factor (matching
      // the exact formulas in every player component).
      const tL = Math.max(1.5, (link.value / total) * (AVAIL * 0.68)); // left scale
      const tM = (link.value / leftNode.value) * midSeg.h;              // mid scale
      const tR = Math.max(1.5, (link.value / total) * (AVAIL * 0.72)); // right scale

      // Left flow: left node → centre bar
      const lCy  = lCursor[leftNode.id] + tL / 2;
      const mCyL = mCursor[leftNode.id] + tM / 2;
      leftFlows.push({
        id:      `lf${fid}`,
        leftId:  leftNode.id,
        rightId: link.rightId,
        value:   link.value,
        color:   leftNode.color,
        x1: lNode.x, y1: lCy,  t1: tL,
        x2: MID_X,   y2: mCyL, t2: tM,
      });

      // Right flow: centre bar → right node
      const rCy = rCursor[link.rightId] + tR / 2;
      rightFlows.push({
        id:      `rf${fid}`,
        leftId:  leftNode.id,
        rightId: link.rightId,
        value:   link.value,
        color:   rNode.color,
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
// computeLayout  — generic v2 schema layout (kept for non-butterfly use)
// ---------------------------------------------------------------------------

/**
 * Assign pixel positions to nodes in one column.
 * @private
 */
function layoutColumn(nodes, total, gap, xPos) {
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
export function computeLayout(diagram) {
  const { meta, columns, nodes, links } = diagram;
  const total = meta.total;

  if (columns.length < 2) {
    throw new Error('[layout] Diagram must have at least 2 columns.');
  }

  // Split nodes by column (overlap nodes excluded from height calc)
  const byColumn = new Map();
  for (const col of columns) byColumn.set(col.id, []);
  for (const node of nodes) {
    if (!node.overlap) byColumn.get(node.column)?.push(node);
  }

  const colIds = columns.map(c => c.id);

  // Evenly distribute columns across canvas width
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
      layoutColumn(colNodes, total, gap, xPositions.get(col.id))
    );
  }

  const positionedNodes = colIds.flatMap(id => positionedByCol.get(id) ?? []);
  const nodeMap         = new Map(positionedNodes.map(n => [n.id, n]));
  const sourceOffset    = new Map(positionedNodes.map(n => [n.id, 0]));
  const targetOffset    = new Map(positionedNodes.map(n => [n.id, 0]));

  const positionedLinks = links.map(link => {
    // Accept both {from,to} (PROJECT.md spec) and {source,target} (legacy)
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
      source: srcId,
      target: tgtId,
      value:  link.value,
      sy:     src.y + sy,
      ty:     tgt.y + ty,
      sh,
      th,
      color:  link.color,
    };
  });

  return { nodes: positionedNodes, links: positionedLinks, canvas: CANVAS };
}

/**
 * lib/creator/layout.js
 *
 * Layout engine — converts a validated SankeyDiagram v2 object into
 * pixel-positioned layout data ready for SankeyRenderer.jsx.
 *
 * Produces the same "butterfly flow" geometry used in the hand-coded
 * player components: left column → centre → right column, with
 * cursor-tracked ribbon stacking.
 *
 * Constants match the values documented in PROJECT.md:
 *   W=960, H=540, LEFT_X=155, MID_X=480, RIGHT_X=810,
 *   NODE_W=16, L_GAP=20, R_GAP=28, MID_H=AVAIL*0.60
 */

// ---------------------------------------------------------------------------
// Canvas constants  (mirror PROJECT.md "Key layout constants")
// ---------------------------------------------------------------------------

export const CANVAS = {
  W:       960,
  H:       540,
  LEFT_X:  155,
  MID_X:   480,
  RIGHT_X: 810,
  NODE_W:  16,
  L_GAP:   20,   // gap between left nodes
  R_GAP:   28,   // gap between right nodes
  PADDING: 48,   // top/bottom padding
  /** Height available for nodes after removing padding */
  get AVAIL() { return this.H - this.PADDING * 2; },
  /** Maximum height used by the centre flow ribbon */
  get MID_H() { return this.AVAIL * 0.60; },
};

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PositionedNode
 * @property {string}  id
 * @property {string}  column
 * @property {string}  label
 * @property {number}  value
 * @property {boolean} overlap
 * @property {number}  x        - Left edge of the node bar
 * @property {number}  y        - Top edge of the node bar
 * @property {number}  width    - NODE_W
 * @property {number}  height   - Pixel height proportional to value
 * @property {string}  [color]
 */

/**
 * @typedef {Object} PositionedLink
 * @property {string} source
 * @property {string} target
 * @property {number} value
 * @property {number} sy     - Source y-offset within source node (pixels from top)
 * @property {number} ty     - Target y-offset within target node (pixels from top)
 * @property {number} sh     - Ribbon height at source end
 * @property {number} th     - Ribbon height at target end
 * @property {string} [color]
 */

/**
 * @typedef {Object} DiagramLayout
 * @property {PositionedNode[]} nodes
 * @property {PositionedLink[]} links
 * @property {typeof CANVAS}   canvas
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assign pixel heights to nodes in a column, proportional to value,
 * with AVAIL as the total available height.
 *
 * @param {import("../schema/sankey.schema.json").nodes} nodes   - Nodes for one column (non-overlap)
 * @param {number} total  - meta.total (used as denominator)
 * @param {number} gap    - Gap in px between consecutive nodes
 * @param {number} xPos   - Left edge x of this column's node bars
 * @returns {PositionedNode[]}
 */
function layoutColumn(nodes, total, gap, xPos) {
  if (!nodes.length) return [];

  const availHeight = CANVAS.AVAIL - gap * (nodes.length - 1);
  let cursor = CANVAS.PADDING;

  return nodes.map((node) => {
    const h = Math.max(1, (node.value / total) * availHeight);
    const positioned = {
      ...node,
      overlap: node.overlap ?? false,
      x:       xPos,
      y:       cursor,
      width:   CANVAS.NODE_W,
      height:  h,
    };
    cursor += h + gap;
    return positioned;
  });
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

/**
 * Convert a validated SankeyDiagram v2 object to a pixel layout.
 *
 * Supports 2-column diagrams (left + right).
 * Multi-column support (3+) is stubbed — extends the same pattern.
 *
 * @param {import("../schema/sankey.schema.json")} diagram
 * @returns {DiagramLayout}
 */
export function computeLayout(diagram) {
  const { meta, columns, nodes, links } = diagram;
  const total = meta.total;

  if (columns.length < 2) {
    throw new Error("[layout] Diagram must have at least 2 columns.");
  }

  // Split nodes by column (skip overlap nodes for height calculation)
  const byColumn = new Map();
  for (const col of columns) byColumn.set(col.id, []);
  for (const node of nodes) {
    if (!node.overlap) byColumn.get(node.column)?.push(node);
  }

  const colIds    = columns.map((c) => c.id);
  const leftColId = colIds[0];
  const rightColId = colIds[colIds.length - 1];

  // x positions: spread evenly across canvas width
  const xPositions = new Map();
  colIds.forEach((id, i) => {
    if (colIds.length === 2) {
      xPositions.set(id, i === 0 ? CANVAS.LEFT_X : CANVAS.RIGHT_X);
    } else {
      const step = (CANVAS.RIGHT_X - CANVAS.LEFT_X) / (colIds.length - 1);
      xPositions.set(id, CANVAS.LEFT_X + i * step);
    }
  });

  // Layout each column
  const positionedByCol = new Map();
  for (const col of columns) {
    const colNodes = byColumn.get(col.id) ?? [];
    const gap      = col.id === leftColId ? CANVAS.L_GAP : CANVAS.R_GAP;
    positionedByCol.set(
      col.id,
      layoutColumn(colNodes, total, gap, xPositions.get(col.id))
    );
  }

  // Flatten into a single array preserving column order
  const positionedNodes = colIds.flatMap((id) => positionedByCol.get(id) ?? []);

  // Build a lookup map for O(1) access
  const nodeMap = new Map(positionedNodes.map((n) => [n.id, n]));

  // Accumulate ribbon offsets (how far down each node's bar we've consumed)
  const sourceOffset = new Map(positionedNodes.map((n) => [n.id, 0]));
  const targetOffset = new Map(positionedNodes.map((n) => [n.id, 0]));

  // Build positioned links
  const positionedLinks = links.map((link) => {
    const src = nodeMap.get(link.source);
    const tgt = nodeMap.get(link.target);
    if (!src || !tgt) {
      throw new Error(
        `[layout] Link references unknown node: ${link.source} → ${link.target}`
      );
    }

    const srcFrac = link.value / src.value;
    const tgtFrac = link.value / tgt.value;
    const sh = srcFrac * src.height;
    const th = tgtFrac * tgt.height;

    const sy = (sourceOffset.get(link.source) ?? 0);
    const ty = (targetOffset.get(link.target) ?? 0);

    sourceOffset.set(link.source, sy + sh);
    targetOffset.set(link.target, ty + th);

    return {
      source: link.source,
      target: link.target,
      value:  link.value,
      sy:     src.y + sy,
      ty:     tgt.y + ty,
      sh,
      th,
      color:  link.color,
    };
  });

  return {
    nodes:  positionedNodes,
    links:  positionedLinks,
    canvas: CANVAS,
  };
}

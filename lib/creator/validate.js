/**
 * lib/creator/validate.js
 *
 * Runtime validation for SankeyDiagram v2 objects.
 * Throws descriptive errors so diagram bugs surface at data-load time,
 * not silently as rendering artifacts.
 *
 * Usage:
 *   import { validateDiagram } from "@/lib/creator/validate";
 *   validateDiagram(data); // throws on failure, returns void on success
 */

/**
 * Validate a SankeyDiagram v2 object.
 *
 * Checks performed:
 *   1. Required top-level keys exist
 *   2. meta.total > 0
 *   3. columns[] has at least one entry with id + label
 *   4. Every node references a valid column id
 *   5. Every link references valid source / target node ids
 *   6. Non-overlap column sums are within tolerance of meta.total
 *   7. No self-referencing links
 *
 * @param {import("../schema/sankey.schema.json")} diagram
 * @param {{ tolerance?: number }} [opts]
 *   tolerance — allowed absolute deviation between a column node sum and
 *   meta.total before a warning is emitted (default: 5). Use a higher
 *   value for approximate data (e.g. Haaland clubs Δ48).
 * @throws {Error} on structural violations
 * @returns {void}
 */
export function validateDiagram(diagram, { tolerance = 5 } = {}) {
  // 1. Top-level shape
  for (const key of ["meta", "columns", "nodes", "links"]) {
    if (!(key in diagram)) throw new Error(`[validate] Missing required key: "${key}"`);
  }

  const { meta, columns, nodes, links } = diagram;

  // 2. meta
  if (typeof meta.total !== "number" || meta.total <= 0)
    throw new Error(`[validate] meta.total must be a positive number, got: ${meta.total}`);
  if (!meta.player) throw new Error(`[validate] meta.player is required`);
  if (!meta.unit)   throw new Error(`[validate] meta.unit is required`);

  // 3. columns
  const columnIds = new Set();
  for (const col of columns) {
    if (!col.id)    throw new Error(`[validate] column missing "id": ${JSON.stringify(col)}`);
    if (!col.label) throw new Error(`[validate] column missing "label": ${JSON.stringify(col)}`);
    columnIds.add(col.id);
  }

  // 4. nodes
  const nodeIds = new Set();
  for (const node of nodes) {
    if (!node.id)               throw new Error(`[validate] node missing "id": ${JSON.stringify(node)}`);
    if (!columnIds.has(node.column))
      throw new Error(`[validate] node "${node.id}" references unknown column "${node.column}"`);
    if (typeof node.value !== "number" || node.value < 0)
      throw new Error(`[validate] node "${node.id}" has invalid value: ${node.value}`);
    nodeIds.add(node.id);
  }

  // 5. links
  for (const link of links) {
    if (!nodeIds.has(link.source))
      throw new Error(`[validate] link source "${link.source}" not found in nodes`);
    if (!nodeIds.has(link.target))
      throw new Error(`[validate] link target "${link.target}" not found in nodes`);
    if (link.source === link.target)
      throw new Error(`[validate] self-referencing link on node "${link.source}"`);
    if (typeof link.value !== "number" || link.value < 0)
      throw new Error(`[validate] link ${link.source}→${link.target} has invalid value: ${link.value}`);
  }

  // 6. Column sum checks (skip overlap nodes)
  for (const col of columns) {
    const colNodes   = nodes.filter((n) => n.column === col.id && !n.overlap);
    const colSum     = colNodes.reduce((s, n) => s + n.value, 0);
    const delta      = Math.abs(colSum - meta.total);
    if (delta > tolerance) {
      // Warn rather than throw — CLUBS deltas (e.g. Haaland Δ48) are documented
      console.warn(
        `[validate] column "${col.id}" sum ${colSum} differs from meta.total ${meta.total} ` +
        `by ${delta} (tolerance ${tolerance}). Intentional? Document in DATA VALIDATION comment.`
      );
    }
  }
}

/**
 * Like validateDiagram but returns a result object instead of throwing.
 *
 * @param {import("../schema/sankey.schema.json")} diagram
 * @param {{ tolerance?: number }} [opts]
 * @returns {{ ok: boolean, error: string | null }}
 */
export function tryValidateDiagram(diagram, opts = {}) {
  try {
    validateDiagram(diagram, opts);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

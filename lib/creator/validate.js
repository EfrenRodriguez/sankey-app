/**
 * lib/creator/validate.js
 *
 * Runtime validation for SankeyDiagram v2 objects.
 *
 * Primary export: validateDiagram()
 *   Returns { valid, errors, warnings } — never throws.
 *   Callers that need a throw-on-failure wrapper should check `valid`
 *   themselves (see createDiagram in index.js).
 *
 * Secondary export: tryValidateDiagram()
 *   Backwards-compatible wrapper that returns { ok, error, … }.
 */

// ---------------------------------------------------------------------------
// Core validation logic (internal)
// ---------------------------------------------------------------------------

/**
 * Run all validation checks and return a structured result.
 *
 * @param {object} diagram
 * @param {{ tolerance?: number }} opts
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function _validate(diagram, { tolerance = 5 } = {}) {
  const errors   = [];
  const warnings = [];

  // ── 1. Top-level shape ───────────────────────────────────────────────────
  for (const key of ['meta', 'columns', 'nodes', 'links']) {
    if (!(key in diagram)) errors.push(`Missing required key: "${key}"`);
  }
  if (errors.length) return { valid: false, errors, warnings };

  const { meta, columns, nodes, links } = diagram;

  // ── 2. meta ──────────────────────────────────────────────────────────────
  if (typeof meta.total !== 'number' || meta.total <= 0) {
    errors.push(`meta.total must be a positive number, got: ${meta.total}`);
  }
  // Accept any of the naming conventions found in the codebase
  if (!meta.title && !meta.player && !meta.subject) {
    warnings.push('meta is missing a title identifier (title / player / subject)');
  }
  if (!meta.unit) {
    warnings.push('meta.unit is not set');
  }

  // ── 3. columns ───────────────────────────────────────────────────────────
  const columnIds = new Set();
  for (const col of columns) {
    if (!col.id) {
      errors.push(`column missing "id": ${JSON.stringify(col)}`);
    } else if (!col.label) {
      errors.push(`column "${col.id}" missing "label"`);
    } else {
      columnIds.add(col.id);
    }
  }

  // ── 4. nodes ─────────────────────────────────────────────────────────────
  const nodeIds      = new Set();
  const linkedIds    = new Set(); // populated in step 5

  for (const node of nodes) {
    if (!node.id) {
      errors.push(`node missing "id": ${JSON.stringify(node)}`);
      continue;
    }
    // Column membership (only checked when columns are defined)
    if (columnIds.size > 0 && !columnIds.has(node.column)) {
      errors.push(`node "${node.id}" references unknown column "${node.column}"`);
    }
    if (typeof node.value !== 'number' || node.value < 0) {
      errors.push(`node "${node.id}" has invalid value: ${node.value}`);
    }
    nodeIds.add(node.id);
  }

  // ── 5. links ─────────────────────────────────────────────────────────────
  for (const link of links) {
    // Accept both {from,to} (PROJECT.md v2 spec) and {source,target} (legacy)
    const from = link.from   ?? link.source;
    const to   = link.to     ?? link.target;

    if (!from || !to) {
      errors.push(`link missing from/to identifiers: ${JSON.stringify(link)}`);
      continue;
    }
    if (!nodeIds.has(from)) errors.push(`link "from" "${from}" not found in nodes`);
    if (!nodeIds.has(to))   errors.push(`link "to"   "${to}"   not found in nodes`);
    if (from === to)        errors.push(`self-referencing link on node "${from}"`);
    if (typeof link.value !== 'number' || link.value < 0) {
      errors.push(`link ${from}→${to} has invalid value: ${link.value}`);
    }
    linkedIds.add(from);
    linkedIds.add(to);
  }

  // ── 6. Orphaned nodes ────────────────────────────────────────────────────
  for (const node of nodes) {
    if (!node.overlap && !linkedIds.has(node.id)) {
      warnings.push(`node "${node.id}" has no links (orphaned)`);
    }
  }

  // ── 7. Column sum checks (skip overlap nodes) ─────────────────────────────
  if (errors.length === 0 && meta.total > 0) {
    for (const col of columns) {
      const colNodes = nodes.filter(n => n.column === col.id && !n.overlap);
      const colSum   = colNodes.reduce((s, n) => s + n.value, 0);
      const delta    = Math.abs(colSum - meta.total);
      if (delta > tolerance) {
        warnings.push(
          `column "${col.id}" sum ${colSum} differs from meta.total ${meta.total} ` +
          `by ${delta} (tolerance ${tolerance})`
        );
      }
    }

    // ── 8. meta.total vs right-column terminal node sum (0.1% tolerance) ───
    const rightColId = columns[columns.length - 1]?.id;
    if (rightColId) {
      const rightNodes = nodes.filter(n => n.column === rightColId && !n.overlap);
      if (rightNodes.length > 0) {
        const rightSum  = rightNodes.reduce((s, n) => s + n.value, 0);
        const rightDiff = Math.abs(rightSum - meta.total);
        const pctTol    = meta.total * 0.001; // 0.1 %
        if (rightDiff > pctTol) {
          warnings.push(
            `meta.total (${meta.total}) differs from right-column node sum ` +
            `(${rightSum}) by ${rightDiff.toFixed(1)} — exceeds 0.1% tolerance`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Validate a SankeyDiagram v2 object.
 *
 * @param {object} diagram
 * @param {{ tolerance?: number }} [opts]
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateDiagram(diagram, opts = {}) {
  return _validate(diagram, opts);
}

/**
 * Backwards-compatible wrapper.
 * Returns { ok, error } plus the full { valid, errors, warnings } fields.
 *
 * @param {object} diagram
 * @param {{ tolerance?: number }} [opts]
 * @returns {{ ok: boolean, error: string|null, valid: boolean, errors: string[], warnings: string[] }}
 */
export function tryValidateDiagram(diagram, opts = {}) {
  const result = _validate(diagram, opts);
  return {
    ok:    result.valid,
    error: result.errors[0] ?? null,
    ...result,
  };
}

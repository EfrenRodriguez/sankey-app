/**
 * lib/creator/index.js
 *
 * Public entry point for the creator layer.
 *
 * Primary usage — player JSON schema (SankeyRenderer):
 *   import { computeLayout, bezierPath } from "@/lib/creator";
 *   const layout = computeLayout(schema, { width, height, theme });
 *
 * Secondary usage — butterfly layout (domain-agnostic):
 *   import { computeButterfly } from "@/lib/creator";
 *   const layout = computeButterfly({ leftNodes, rightNodes, links, total });
 *
 * Generic v2 schema:
 *   import { createDiagram } from "@/lib/creator";
 *   const layout = createDiagram(rawDiagramData); // validates then lays out
 *
 * Validate only:
 *   import { validateDiagram } from "@/lib/creator";
 *   const { valid, errors, warnings } = validateDiagram(data);
 */

import { validateDiagram as _validate }  from './validate.js';
import { computeLayoutGeneric }           from './layout.js';

// ── Primary public API ──────────────────────────────────────────────────────
export { computeLayout, bezierPath }            from './layout.js';

// ── Secondary / backwards-compatible exports ────────────────────────────────
export { computeButterfly, ribbon, CANVAS }     from './layout.js';
export { validateDiagram, tryValidateDiagram }  from './validate.js';

/**
 * Validate a SankeyDiagram v2 object and compute its pixel layout.
 * Throws if validation fails.
 *
 * @param {object} diagram — SankeyDiagram v2
 * @param {{ tolerance?: number }} [opts]
 * @throws {Error} if validation finds errors
 */
export function createDiagram(diagram, opts = {}) {
  const { valid, errors } = _validate(diagram, opts);
  if (!valid) {
    throw new Error(`[createDiagram] Validation failed:\n  ${errors.join('\n  ')}`);
  }
  return computeLayoutGeneric(diagram);
}

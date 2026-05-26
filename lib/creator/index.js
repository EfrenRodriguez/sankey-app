/**
 * lib/creator/index.js
 *
 * Public entry point for the creator layer.
 * Combines validation + layout into a single call.
 *
 * Usage:
 *   import { createDiagram } from "@/lib/creator";
 *   const layout = createDiagram(rawDiagramData);
 *   // layout.nodes, layout.links, layout.canvas — pass to <SankeyRenderer />
 */

import { validateDiagram }    from "./validate.js";
import { computeLayout }      from "./layout.js";

export { validateDiagram, tryValidateDiagram } from "./validate.js";
export { computeLayout, CANVAS }               from "./layout.js";

/**
 * Validate a SankeyDiagram v2 object and compute its pixel layout.
 *
 * @param {import("../schema/sankey.schema.json")} diagram
 * @param {{ tolerance?: number }} [opts]   - Passed through to validateDiagram
 * @returns {import("./layout.js").DiagramLayout}
 * @throws {Error} if validation fails or layout computation fails
 */
export function createDiagram(diagram, opts = {}) {
  validateDiagram(diagram, opts);
  return computeLayout(diagram);
}

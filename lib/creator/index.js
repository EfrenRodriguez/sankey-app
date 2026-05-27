/**
 * lib/creator/index.js
 *
 * Public entry point for the creator layer.
 *
 * Usage — butterfly layout (soccer player diagrams):
 *   import { computeButterfly, ribbon } from "@/lib/creator";
 *   const layout = computeButterfly({ leftNodes, rightNodes, links, total });
 *
 * Usage — generic v2 schema layout:
 *   import { createDiagram } from "@/lib/creator";
 *   const layout = createDiagram(rawDiagramData); // validates then lays out
 *
 * Usage — validate only:
 *   import { validateDiagram } from "@/lib/creator";
 *   const { valid, errors, warnings } = validateDiagram(data);
 */

import { validateDiagram as _validate } from './validate.js';
import { computeLayout }                from './layout.js';

export { validateDiagram, tryValidateDiagram } from './validate.js';
export { computeLayout, computeButterfly, ribbon, CANVAS } from './layout.js';

/**
 * Validate a SankeyDiagram v2 object and compute its pixel layout.
 * Throws if validation fails.
 *
 * @param {object} diagram — SankeyDiagram v2
 * @param {{ tolerance?: number }} [opts]
 * @returns {import('./layout.js').DiagramLayout}
 * @throws {Error} if validation finds errors
 */
export function createDiagram(diagram, opts = {}) {
  const { valid, errors } = _validate(diagram, opts);
  if (!valid) {
    throw new Error(`[createDiagram] Validation failed:\n  ${errors.join('\n  ')}`);
  }
  return computeLayout(diagram);
}

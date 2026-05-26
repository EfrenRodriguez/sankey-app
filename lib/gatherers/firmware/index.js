/**
 * lib/gatherers/firmware/index.js
 *
 * Public API for firmware map file parsing and diagram generation.
 *
 * Usage — parse only (Node / browser):
 *   import { parseMapFile } from "@/lib/gatherers/firmware";
 *   const diagram = parseMapFile(mapFileText, { title: "My Firmware" });
 *
 * Usage — generate HTML diagram (Node CLI):
 *   import { generateDiagram } from "@/lib/gatherers/firmware";
 *   // or run directly: node lib/tools/generate-diagram.js <file.map>
 */

export { parseMapFile } from './parser.js';
export { buildHtml as generateDiagram } from '../../tools/generate-diagram.js';

/**
 * lib/gatherers/firmware/index.js
 *
 * Firmware data gatherer — reads a GNU linker .map file and returns a
 * SankeyDiagram v2 object.
 *
 * Usage (Node / server component):
 *   import { getFirmwareData } from "@/lib/gatherers/firmware";
 *   const diagram = await getFirmwareData("/path/to/build.map");
 *
 * Usage (browser / file input):
 *   import { getFirmwareDataFromText } from "@/lib/gatherers/firmware";
 *   const diagram = getFirmwareDataFromText(fileText, { label: "MyFirmware" });
 */

import { parseMapFile, buildFirmwareDiagram } from "./parser.js";

/**
 * Read a .map file from the filesystem (Node.js / server only) and return
 * a SankeyDiagram v2 object.
 *
 * @param {string} mapFilePath - Absolute or relative path to the .map file
 * @param {{ label?: string }} [opts]
 * @returns {Promise<import("../../schema/sankey.schema.json")>}
 */
export async function getFirmwareData(mapFilePath, opts = {}) {
  // Dynamic import keeps `fs` out of client bundles.
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(mapFilePath, "utf8");
  return getFirmwareDataFromText(text, opts);
}

/**
 * Parse raw .map file text (works in browser and Node).
 *
 * @param {string} mapText
 * @param {{ label?: string }} [opts]
 * @returns {import("../../schema/sankey.schema.json")}
 */
export function getFirmwareDataFromText(mapText, opts = {}) {
  const parsed = parseMapFile(mapText);
  return buildFirmwareDiagram(parsed, opts);
}

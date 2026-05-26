/**
 * lib/gatherers/firmware/parser.js
 *
 * Parser for GNU linker map files (.map) produced by arm-none-eabi-ld,
 * ld.lld, or any linker that follows the GNU ld map format.
 *
 * Produces a SankeyDiagram v2 object where:
 *   - Left column  = memory regions (FLASH, RAM, CCMRAM, …)
 *   - Right column = object / section categories (.text, .data, .bss, …)
 *
 * Reference format (GNU ld 2.x):
 *   Linker script and memory map
 *
 *   .text           0x08000000     0x1234
 *                   0x08000000                _start
 *    *(.text)
 *    .text          0x08000000      0x4bc path/to/file.o
 *   ...
 *   Memory Configuration
 *   Name             Origin             Length             Attributes
 *   FLASH            0x0000000008000000 0x0000000000100000 xr
 *   RAM              0x0000000020000000 0x0000000000020000 xrw
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only — no runtime overhead)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MapSection
 * @property {string} name        - Section name, e.g. ".text"
 * @property {number} address     - Load address (hex → number)
 * @property {number} size        - Size in bytes
 * @property {string[]} objects   - Object files contributing to this section
 */

/**
 * @typedef {Object} MemoryRegion
 * @property {string} name   - Region name, e.g. "FLASH"
 * @property {number} origin - Start address
 * @property {number} length - Region size in bytes
 * @property {string} attrs  - Attribute string, e.g. "xr"
 */

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

// Section header:  .text  0x08000000  0x1234
const RE_SECTION_HEADER = /^(\.\w[\w.*-]*)[ \t]+(0x[\da-fA-F]+)[ \t]+(0x[\da-fA-F]+)/;

// Object file contribution:  .text  0x08000000  0x4bc  path/to/file.o
const RE_OBJECT_LINE =
  /^[ \t]+(\.\w[\w.*-]*)[ \t]+(0x[\da-fA-F]+)[ \t]+(0x[\da-fA-F]+)[ \t]+(.+\.(?:o|a\(.*\)))/;

// Memory region table row:  FLASH  0x0000000008000000  0x0000000000100000  xr
const RE_MEMORY_REGION =
  /^(\w+)[ \t]+(0x[\da-fA-F]+)[ \t]+(0x[\da-fA-F]+)[ \t]+(\w+)/;

// Markers
const RE_MEMORY_CONFIG_START = /^Memory Configuration/;
const RE_LINKER_MAP_START    = /^Linker script and memory map/;
const RE_FILL_PADDING        = /^\s+\*fill\*/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {string} hex */
const hexToNum = (hex) => parseInt(hex, 16);

/**
 * Classify a section name into a broad category for the right-column node.
 * @param {string} name
 * @returns {string}
 */
function classifySection(name) {
  if (name.startsWith(".text") || name.startsWith(".rodata") || name.startsWith(".ARM.ex"))
    return "Code (.text / .rodata)";
  if (name.startsWith(".data"))
    return "Initialized data (.data)";
  if (name.startsWith(".bss") || name.startsWith(".noinit"))
    return "Zero-init data (.bss)";
  if (name.startsWith(".stack") || name.startsWith(".heap"))
    return "Stack / Heap";
  if (name.startsWith(".debug") || name.startsWith(".comment") || name.startsWith(".symtab"))
    return "Debug symbols";
  return "Other";
}

/**
 * Determine which memory region (left-column node) owns an address.
 * @param {number} address
 * @param {MemoryRegion[]} regions
 * @returns {string} region name, or "Unknown"
 */
function regionForAddress(address, regions) {
  for (const r of regions) {
    if (address >= r.origin && address < r.origin + r.length) return r.name;
  }
  return "Unknown";
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

/**
 * Parse the text content of a GNU ld .map file.
 *
 * @param {string} mapText - Full contents of the .map file
 * @returns {{ sections: MapSection[], regions: MemoryRegion[] }}
 */
export function parseMapFile(mapText) {
  const lines = mapText.split(/\r?\n/);

  /** @type {MapSection[]} */
  const sections = [];
  /** @type {MemoryRegion[]} */
  const regions = [];

  let inMemoryConfig = false;
  let inLinkerMap    = false;
  /** @type {MapSection|null} */
  let currentSection = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // ---- State transitions ------------------------------------------------
    if (RE_MEMORY_CONFIG_START.test(line)) { inMemoryConfig = true;  inLinkerMap = false; continue; }
    if (RE_LINKER_MAP_START.test(line))    { inLinkerMap    = true;  inMemoryConfig = false; continue; }

    // ---- Memory configuration table ---------------------------------------
    if (inMemoryConfig) {
      const m = RE_MEMORY_REGION.exec(line);
      if (m && m[1] !== "Name") {                      // skip header row
        regions.push({
          name:   m[1],
          origin: hexToNum(m[2]),
          length: hexToNum(m[3]),
          attrs:  m[4],
        });
      }
      continue;
    }

    // ---- Linker map section -----------------------------------------------
    if (!inLinkerMap) continue;
    if (RE_FILL_PADDING.test(line)) continue;           // skip padding entries

    // Section header (top-level)
    const secMatch = RE_SECTION_HEADER.exec(line);
    if (secMatch && !line.match(/^\s/)) {
      currentSection = {
        name:    secMatch[1],
        address: hexToNum(secMatch[2]),
        size:    hexToNum(secMatch[3]),
        objects: [],
      };
      sections.push(currentSection);
      continue;
    }

    // Object-file contribution line (indented)
    const objMatch = RE_OBJECT_LINE.exec(line);
    if (objMatch && currentSection) {
      const size = hexToNum(objMatch[3]);
      if (size > 0) {
        currentSection.objects.push(objMatch[4].trim());
      }
    }
  }

  return { sections, regions };
}

// ---------------------------------------------------------------------------
// SankeyDiagram v2 builder
// ---------------------------------------------------------------------------

/**
 * Convert parsed .map data into a SankeyDiagram v2 object.
 *
 * @param {{ sections: MapSection[], regions: MemoryRegion[] }} parsed
 * @param {{ label?: string }} [opts]
 * @returns {import("../../schema/sankey.schema.json")}
 */
export function buildFirmwareDiagram(parsed, opts = {}) {
  const { sections, regions } = parsed;

  // Accumulate bytes: region → category
  /** @type {Map<string, Map<string, number>>} */
  const regionCategoryBytes = new Map();

  for (const sec of sections) {
    if (sec.size === 0) continue;
    const regionName   = regionForAddress(sec.address, regions);
    const categoryName = classifySection(sec.name);

    if (!regionCategoryBytes.has(regionName)) regionCategoryBytes.set(regionName, new Map());
    const catMap = regionCategoryBytes.get(regionName);
    catMap.set(categoryName, (catMap.get(categoryName) ?? 0) + sec.size);
  }

  // Build unique node lists
  const regionNames   = [...regionCategoryBytes.keys()];
  const categoryNames = [
    ...new Set(
      [...regionCategoryBytes.values()].flatMap((m) => [...m.keys()])
    ),
  ];

  const total = regionNames.reduce((sum, r) => {
    return sum + [...(regionCategoryBytes.get(r)?.values() ?? [])].reduce((s, v) => s + v, 0);
  }, 0);

  const nodes = [
    ...regionNames.map((name) => ({
      id:     `region_${name}`,
      column: "regions",
      label:  name,
      value:  [...(regionCategoryBytes.get(name)?.values() ?? [])].reduce((s, v) => s + v, 0),
    })),
    ...categoryNames.map((name) => ({
      id:     `cat_${name.replace(/[^a-zA-Z0-9]/g, "_")}`,
      column: "categories",
      label:  name,
      value:  regionNames.reduce((s, r) => s + (regionCategoryBytes.get(r)?.get(name) ?? 0), 0),
    })),
  ];

  const links = [];
  for (const [regionName, catMap] of regionCategoryBytes) {
    for (const [catName, bytes] of catMap) {
      if (bytes === 0) continue;
      links.push({
        source: `region_${regionName}`,
        target: `cat_${catName.replace(/[^a-zA-Z0-9]/g, "_")}`,
        value:  bytes,
      });
    }
  }

  return {
    meta: {
      player:      opts.label ?? "Firmware",
      total,
      unit:        "goals",           // reuse schema unit field; renderer maps to "bytes"
      description: "GNU ld memory map",
    },
    columns: [
      { id: "regions",    label: "Memory Region" },
      { id: "categories", label: "Section Category" },
    ],
    nodes,
    links,
  };
}

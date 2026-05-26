// AGENT 1 — Firmware Memory Map Parser
// Input: GNU linker .map file contents as string
// Output: validated JSON (Sankey schema-compatible)
//
// Compatible with: GNU ld, arm-none-eabi-ld, KPIT GCC, and other GNU-compatible linkers
// Map file structure: archive cross-reference section + linker output sections
//
// Sankey flow:
//   Memory Region (Flash/RAM) → Section (.text/.bss/etc) → Module (source tree group)

// ---------------------------------------------------------------------------
// Section classification
//
// Sections are classified into memory regions using standard GNU ld naming
// conventions. Unknown sections are skipped rather than misclassified.
// Extend ROM_PATTERNS or RAM_PATTERNS for non-standard section names.
// ---------------------------------------------------------------------------

const ROM_PATTERNS = [
  /^\.text/i,         // executable code
  /^\.rodata/i,       // read-only data / string literals
  /^\.eh_frame/i,     // exception handling frames
  /^\.init_array/i,   // C++ constructor lists
  /^\.fini_array/i,   // C++ destructor lists
  /^\.ARM\./i,        // ARM-specific (extab, exidx)
  /vector/i,          // interrupt/exception vectors (.isr_vector, .fvectors, .vectors, .dtcVectorTable, …)
  /^\.boot/i,         // boot sections
  /^\.reset/i,        // reset handler sections
  /^\.const/i,        // constants (Xtensa, TI C6000, …)
  /^\.literal/i,      // Xtensa literal pool
];

const RAM_PATTERNS = [
  /^\.data/i,         // initialized variables
  /^\.bss/i,          // zero-initialized variables
  /^\.stack/i,        // stack (catches .stack, .stackCheck, .stack_dummy, …)
  /^\.heap/i,         // heap
  /^\.noinit/i,       // non-initialized section (startup skips zeroing)
  /^\.ccmram/i,       // Core-Coupled Memory (STM32)
  /^\.sram/i,         // explicit SRAM sections
  /^\.dtcram/i,       // DTCM RAM (STM32)
  /^\.ocram/i,        // On-Chip RAM
];

const SKIP_PATTERNS = [
  /^\.debug/i,        // DWARF debug info
  /^\.comment/i,      // compiler identification string
  /^\.note/i,         // ELF notes
  /^\.symtab/i,       // symbol table
  /^\.strtab/i,       // string table
  /^\.gnu\./i,        // GNU-specific metadata
  /^\.rel\./i,        // relocation tables
  /^\.rela\./i,       // relocation tables with addends
];

/**
 * Classify a section name into 'flash', 'ram', or null (skip).
 * @param {string} name - e.g. ".text", ".bss", ".parametricData"
 * @returns {'flash'|'ram'|null}
 */
function classifySection(name) {
  if (SKIP_PATTERNS.some(p => p.test(name))) return null;
  if (ROM_PATTERNS.some(p => p.test(name)))  return 'flash';
  if (RAM_PATTERNS.some(p => p.test(name)))  return 'ram';
  return null; // unknown → skip
}

// ---------------------------------------------------------------------------
// Module grouping
//
// Derives a logical module name from the source file path with no hardcoded
// product or project names. The heuristic handles the three common patterns
// found in GNU ld map files:
//
//   1. Absolute path           → "toolchain"   (system / runtime libs)
//   2. archive.a(member.o)     → archive name  (e.g. "libstdc++", "mylib")
//   3. .../Source/Module/...   → Module name   (common source tree layout)
//   4. anything else           → filename stem (last resort)
// ---------------------------------------------------------------------------

/**
 * Derive a module group label from a source file path.
 * @param {string} sourcePath
 * @returns {string}
 */
function getModuleGroup(sourcePath) {
  // Rule 1 — absolute paths are system / toolchain libraries
  if (sourcePath.startsWith('/') || /^[A-Z]:[/\\]/i.test(sourcePath)) {
    return 'toolchain';
  }

  // Rule 2 — archive members: "path/to/libfoo.a(member.c.o)" → "libfoo"
  const archiveMatch = sourcePath.match(/([^/\\]+)\.(?:a|lib)\([^)]*\)$/i);
  if (archiveMatch) return archiveMatch[1];

  // Rule 3 — conventional source tree layout: ".../Source/ModuleName/..."
  //           also handles lowercase "src"
  const srcMatch = sourcePath.match(/[/\\](?:Source|src)[/\\]([^/\\]+)/i);
  if (srcMatch) return srcMatch[1];

  // Rule 4 — fallback: filename stem without extensions (.c.o, .s.o, …)
  const parts = sourcePath.split(/[/\\]/);
  const fname  = parts[parts.length - 1] || '';
  return fname.replace(/(\.\w+)+$/, '') || 'other';
}

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

/** ".text" → "sec_text" */
function sectionId(name) {
  return 'sec_' + name.replace(/^\./, '').replace(/[^a-zA-Z0-9]/g, '_');
}

/** "libfoo" → "mod_libfoo" */
function moduleId(name) {
  return 'mod_' + name.replace(/[^a-zA-Z0-9]/g, '_');
}

// ---------------------------------------------------------------------------
// Color palettes (region colors fixed; section/module auto-assigned by index)
// ---------------------------------------------------------------------------

const REGION_COLORS = { flash: '#4F86C6', ram: '#5BAD8F' };

const SECTION_PALETTE = [
  '#4F86C6', '#9B59B6', '#E8A838', '#C9625F', '#5BAD8F',
  '#E8361A', '#718096', '#F39C12', '#1ABC9C', '#e67e22',
];

const MODULE_PALETTE = [
  '#4F86C6', '#5BAD8F', '#E8A838', '#C9625F', '#9B59B6',
  '#E8361A', '#718096', '#a0aec0', '#F39C12', '#1ABC9C',
];

// ---------------------------------------------------------------------------
// Regex patterns for map file parsing
// ---------------------------------------------------------------------------

// Top-level section header — single line: .sectionname 0xADDR 0xSIZE [extra...]
const RE_TOP_ONELINE  = /^(\.[\w]+)\s+(0x[0-9a-f]+)\s+(0x[0-9a-f]+)/i;

// Top-level section header — name only (size on next indented line)
const RE_TOP_NAMEONLY = /^(\.[\w]+)\s*$/;

// Size-only continuation for split section header: WS 0xADDR 0xSIZE (no file)
const RE_SIZE_ONLY    = /^\s+(0x[0-9a-f]+)\s+(0x[0-9a-f]+)\s*$/i;

// Single-line contribution: WS .subsection 0xADDR 0xSIZE sourcefile
const RE_CONT_SINGLE  = /^\s+(\.[\w.]+)\s+(0x[0-9a-f]+)\s+(0x[0-9a-f]+)\s+(\S+)\s*$/i;

// Start of split contribution: WS .subsection.name  (name alone on its line)
const RE_CONT_NAME    = /^\s+(\.[\w.]+)\s*$/;

// Continuation of split contribution: WS 0xADDR 0xSIZE sourcefile
const RE_CONT_ADDR    = /^\s+(0x[0-9a-f]+)\s+(0x[0-9a-f]+)\s+(\S+)\s*$/i;

// ---------------------------------------------------------------------------
// Source file detection
// ---------------------------------------------------------------------------

/**
 * True when a path token looks like a compiled object or archive member.
 * Covers: foo.c.o  foo.s.o  foo.o  lib.a(member.o)  lib.lib(member.o)
 */
function isSourceFile(path) {
  return path.endsWith('.o') || path.endsWith('.o)');
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a GNU ld linker .map file and return a Sankey-compatible diagram object.
 *
 * @param {string} mapContents - Full text of the .map file
 * @param {object} [options]
 * @param {string} [options.title]  - Diagram title (default: "Firmware — Memory Map Analysis")
 * @param {string} [options.source] - Source attribution shown in footer
 * @returns {object} Sankey-compatible diagram with validation block
 */
export function parseMapFile(mapContents, options = {}) {
  const {
    title  = 'Firmware — Memory Map Analysis',
    source = 'GNU ld map file',
  } = options;

  const lines = mapContents.split(/\r?\n/);

  // ── STEP 0: Find "Linker script and memory map" marker ───────────────────
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'Linker script and memory map') {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error(
      'parseMapFile: could not find "Linker script and memory map" in input. ' +
      'Ensure the file is a GNU ld map (produced with -Map flag).'
    );
  }

  // ── STEP 1: Parse sections and accumulate module bytes ────────────────────
  //
  // moduleBytes[sectionName][moduleName] = totalBytes
  // sectionTotals[sectionName]           = section size from header
  // sectionRegion[sectionName]           = 'flash' | 'ram'
  const moduleBytes   = {};   // { '.text': { 'Common': 123, ... }, ... }
  const sectionTotals = {};   // { '.text': 254384, ... }
  const sectionRegion = {};   // { '.text': 'flash', '.bss': 'ram', ... }

  let currentSection = null;  // top-level section currently being parsed
  let pendingSubsec  = null;  // subsection name awaiting continuation line

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // ── Top-level section headers (column 0, start with '.') ───────────────
    if (line.length > 0 && line[0] === '.') {

      // Form 1: .section 0xADDR 0xSIZE [optional extra text]
      const m1 = RE_TOP_ONELINE.exec(line);
      if (m1) {
        currentSection = m1[1];
        pendingSubsec  = null;
        const region   = classifySection(currentSection);
        if (region) {
          sectionRegion[currentSection]  = region;
          sectionTotals[currentSection]  = parseInt(m1[3], 16);
          moduleBytes[currentSection]    = moduleBytes[currentSection] || {};
        }
        continue;
      }

      // Form 2: .section  (size appears on the next indented line)
      const m2 = RE_TOP_NAMEONLY.exec(line);
      if (m2) {
        currentSection = m2[1];
        pendingSubsec  = null;
        const region   = classifySection(currentSection);
        if (region) {
          sectionRegion[currentSection] = region;
          moduleBytes[currentSection]   = moduleBytes[currentSection] || {};
        }
        continue;
      }
    }

    // ── Size-only continuation for split section header ─────────────────────
    // Fires once per section while its size is still unknown.
    if (currentSection &&
        sectionRegion[currentSection] &&
        sectionTotals[currentSection] === undefined) {
      const ms = RE_SIZE_ONLY.exec(line);
      if (ms) {
        sectionTotals[currentSection] = parseInt(ms[2], 16);
        continue;
      }
    }

    // ── Skip lines outside classified sections ──────────────────────────────
    if (!currentSection || !sectionRegion[currentSection]) {
      pendingSubsec = null;
      continue;
    }

    // ── Contribution lines (must be indented) ───────────────────────────────
    if (!(line[0] === ' ' || line[0] === '\t')) {
      pendingSubsec = null;
      continue;
    }

    // Single-line: WS .subsection 0xADDR 0xSIZE sourcefile
    const sc = RE_CONT_SINGLE.exec(line);
    if (sc) {
      const subsec = sc[1], size = parseInt(sc[3], 16), src = sc[4];
      // Only accumulate bytes from subsections that belong to this parent section
      // (e.g. skip .DtcTable inside .data, or .header inside .text).
      if (size > 0 && isSourceFile(src) && subsec.startsWith(currentSection)) {
        const mod = getModuleGroup(src);
        moduleBytes[currentSection][mod] = (moduleBytes[currentSection][mod] || 0) + size;
      }
      pendingSubsec = null;
      continue;
    }

    // Start of split contribution: WS .subsection.name  (name only)
    const sn = RE_CONT_NAME.exec(line);
    if (sn) {
      pendingSubsec = sn[1];
      continue;
    }

    // Continuation of split contribution: WS 0xADDR 0xSIZE sourcefile
    if (pendingSubsec !== null) {
      const cc = RE_CONT_ADDR.exec(line);
      if (cc) {
        const size = parseInt(cc[2], 16), src = cc[3];
        if (size > 0 && isSourceFile(src) && pendingSubsec.startsWith(currentSection)) {
          const mod = getModuleGroup(src);
          moduleBytes[currentSection][mod] = (moduleBytes[currentSection][mod] || 0) + size;
        }
      }
      pendingSubsec = null;
      continue;
    }

    // All other indented lines (symbol defs, fill directives, linker assignments) — no-op
  }

  // ── STEP 2: Compute region totals ────────────────────────────────────────
  const flashSections = Object.keys(sectionRegion).filter(s => sectionRegion[s] === 'flash');
  const ramSections   = Object.keys(sectionRegion).filter(s => sectionRegion[s] === 'ram');

  const flashTotal = flashSections.reduce((s, sec) => s + (sectionTotals[sec] || 0), 0);
  const ramTotal   = ramSections  .reduce((s, sec) => s + (sectionTotals[sec] || 0), 0);

  // All sections in discovery order (flash first, then ram)
  const allSections = [...flashSections, ...ramSections];

  // Collect all module groups across all sections
  const allModuleSet = new Set();
  for (const sec of allSections) {
    for (const mod of Object.keys(moduleBytes[sec] || {})) allModuleSet.add(mod);
  }

  // Per-module total across all sections
  const moduleTotals = {};
  for (const mod of allModuleSet) {
    moduleTotals[mod] = allSections.reduce((s, sec) => s + (moduleBytes[sec]?.[mod] || 0), 0);
  }

  // ── STEP 3: Assign colors ─────────────────────────────────────────────────
  const sectionColorMap = {};
  allSections.forEach((sec, i) => {
    sectionColorMap[sec] = SECTION_PALETTE[i % SECTION_PALETTE.length];
  });

  const moduleList = Object.entries(moduleTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const moduleColorMap = {};
  moduleList.forEach((mod, i) => {
    moduleColorMap[mod] = MODULE_PALETTE[i % MODULE_PALETTE.length];
  });

  // ── STEP 4: Build nodes ───────────────────────────────────────────────────
  const regionNodes = [];
  if (flashTotal > 0) regionNodes.push({ id: 'flash', column: 'region', label: 'Flash (ROM)', value: flashTotal, color: REGION_COLORS.flash });
  if (ramTotal   > 0) regionNodes.push({ id: 'ram',   column: 'region', label: 'RAM',         value: ramTotal,   color: REGION_COLORS.ram   });

  const sectionNodes = allSections
    .filter(sec => sectionTotals[sec] > 0)
    .map(sec => ({
      id:     sectionId(sec),
      column: 'section',
      label:  sec,
      value:  sectionTotals[sec],
      color:  sectionColorMap[sec],
    }));

  const moduleNodes = moduleList.map(mod => ({
    id:     moduleId(mod),
    column: 'module',
    label:  mod,
    value:  moduleTotals[mod],
    color:  moduleColorMap[mod],
  }));

  const nodes = [...regionNodes, ...sectionNodes, ...moduleNodes];

  // ── STEP 5: Build links ───────────────────────────────────────────────────
  const links = [];

  // region → section
  for (const sec of allSections) {
    if (!sectionTotals[sec]) continue;
    links.push({
      from:  sectionRegion[sec] === 'flash' ? 'flash' : 'ram',
      to:    sectionId(sec),
      value: sectionTotals[sec],
    });
  }

  // section → module
  for (const sec of allSections) {
    for (const [mod, bytes] of Object.entries(moduleBytes[sec] || {})) {
      if (bytes > 0) links.push({ from: sectionId(sec), to: moduleId(mod), value: bytes });
    }
  }

  // ── STEP 6: Validation block ──────────────────────────────────────────────
  const sectionBreakdown = Object.fromEntries(
    allSections.map(sec => [sec, sectionTotals[sec] || 0])
  );
  const moduleBreakdown = Object.fromEntries(
    allSections.map(sec => [sec, { ...moduleBytes[sec] }])
  );

  // ── STEP 7: Return schema-compatible output ───────────────────────────────
  return {
    meta: {
      title,
      subtitle: 'Flash & RAM allocation by module',
      total:    flashTotal + ramTotal,
      unit:     'bytes',
      source,
      theme:    'light',
    },
    columns: [
      { id: 'region',  label: 'MEMORY REGION', index: 0 },
      { id: 'section', label: 'SECTION',        index: 1 },
      { id: 'module',  label: 'MODULE',          index: 2 },
    ],
    nodes,
    links,
    validation: {
      flashTotal,
      ramTotal,
      sectionBreakdown,
      moduleBreakdown,
    },
  };
}

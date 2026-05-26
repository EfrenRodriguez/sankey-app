/**
 * lib/styles/themes/dark.js
 *
 * Dark theme — future use. Inverts surfaces and softens palette.
 */

import { tokens } from "../tokens.js";

/** @type {import("../index.js").Theme} */
export const darkTheme = {
  name: "dark",

  // Surface colours
  background:   "#0f1117",
  surface:      "#1a1d27",
  surfaceHover: "#252836",
  border:       "#2d3148",

  // Text
  textPrimary:   "#f0f4f8",
  textSecondary: "#94a3b8",
  textMuted:     "#64748b",

  // Sankey node palette (left column) — slightly brighter for dark bg
  nodeColors: {
    default: [
      "#748ffc", // indigo
      "#4dd4e7", // cyan
      "#8ce99a", // green
      "#ffc078", // orange
      "#f783ac", // pink
      "#da77f2", // violet
      "#c0eb75", // lime
      "#ff8787", // red
    ],
  },

  // Ribbon
  ribbon: {
    fill:         "rgba(148, 163, 184, 0.18)",
    fillHover:    "rgba(148, 163, 184, 0.55)",
    stroke:       "none",
  },

  // Nav bar
  nav: {
    background:    "#0f1117",
    border:        "#2d3148",
    logoColor:     "#f0f4f8",
    linkIdle:      "#64748b",
    linkActive:    "#f0f4f8",
    linkActiveLine:"#748ffc",
  },

  // Typography (reference tokens)
  font: tokens.fontFamily,
};

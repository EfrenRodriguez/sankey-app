/**
 * lib/styles/themes/light.js
 *
 * Light theme — matches the current production look of Goal Anatomy.
 */

import { tokens } from "../tokens.js";

/** @type {import("../index.js").Theme} */
export const lightTheme = {
  name: "light",

  // Surface colours
  background:   "#ffffff",
  surface:      "#f7f8fa",
  surfaceHover: "#edf0f4",
  border:       "#e2e8f0",

  // Text
  textPrimary:   "#1a202c",
  textSecondary: "#718096",
  textMuted:     "#a0aec0",

  // Sankey node palette (left column)
  nodeColors: {
    default: [
      "#4c6ef5", // indigo
      "#3bc9db", // cyan
      "#69db7c", // green
      "#ffa94d", // orange
      "#f06595", // pink
      "#cc5de8", // violet
      "#a9e34b", // lime
      "#ff6b6b", // red
    ],
  },

  // Ribbon
  ribbon: {
    fill:         "rgba(100, 116, 139, 0.22)",
    fillHover:    "rgba(100, 116, 139, 0.65)",
    stroke:       "none",
  },

  // Nav bar
  nav: {
    background:    "#ffffff",
    border:        "#e2e8f0",
    logoColor:     "#1a202c",
    linkIdle:      "#718096",
    linkActive:    "#1a202c",
    linkActiveLine:"#1a202c",
  },

  // Typography (reference tokens)
  font: tokens.fontFamily,
};

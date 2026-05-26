/**
 * lib/styles/index.js
 *
 * Public entry point for the styles layer.
 *
 * Usage:
 *   import { lightTheme, darkTheme, tokens, getTheme } from "@/lib/styles";
 */

import { lightTheme } from "./themes/light.js";
import { darkTheme }  from "./themes/dark.js";
import { tokens }     from "./tokens.js";

export { tokens, lightTheme, darkTheme };

/**
 * @typedef {Object} Theme
 * @property {string} name
 * @property {string} background
 * @property {string} surface
 * @property {string} surfaceHover
 * @property {string} border
 * @property {string} textPrimary
 * @property {string} textSecondary
 * @property {string} textMuted
 * @property {{ default: string[] }} nodeColors
 * @property {{ fill: string, fillHover: string, stroke: string }} ribbon
 * @property {{ background: string, border: string, logoColor: string, linkIdle: string, linkActive: string, linkActiveLine: string }} nav
 * @property {{ sans: string, mono: string }} font
 */

/**
 * Resolve a theme by name. Falls back to light.
 *
 * @param {"light"|"dark"|string} name
 * @returns {Theme}
 */
export function getTheme(name) {
  if (name === "dark") return darkTheme;
  return lightTheme;
}

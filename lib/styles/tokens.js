/**
 * lib/styles/tokens.js
 *
 * Design tokens — raw values shared across all themes.
 * Themes import from here and override as needed.
 *
 * Keep values as plain JS so they can be consumed by both
 * React components (inline style) and any CSS-in-JS tooling.
 */

export const tokens = {
  // Typography
  fontFamily: {
    sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    mono: "'Geist Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs:   11,
    sm:   13,
    base: 15,
    lg:   18,
    xl:   24,
  },
  fontWeight: {
    normal:    400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
  },
  letterSpacing: {
    tight:  -0.5,
    normal:  0,
    wide:    0.5,
  },

  // Spacing (px)
  space: {
    1:   4,
    2:   8,
    3:  12,
    4:  16,
    5:  20,
    6:  24,
    8:  32,
    10: 40,
    12: 48,
  },

  // Border radius (px)
  radius: {
    sm:   4,
    md:   6,
    lg:  12,
    full: 9999,
  },

  // Elevation / shadow
  shadow: {
    sm:  "0 1px 2px rgba(0,0,0,0.06)",
    md:  "0 2px 8px rgba(0,0,0,0.10)",
    lg:  "0 4px 20px rgba(0,0,0,0.14)",
  },

  // Transition
  transition: {
    fast:   "0.10s ease",
    normal: "0.18s ease",
    slow:   "0.30s ease",
  },

  // Sankey ribbon opacity
  ribbon: {
    opacityIdle:  0.25,
    opacityHover: 0.70,
  },

  // Canvas geometry (mirrors PROJECT.md Key layout constants)
  canvas: {
    W:        960,
    H:        540,
    LEFT_X:   155,
    MID_X:    480,
    RIGHT_X:  810,
    NODE_W:    16,
    L_GAP:     20,
    R_GAP:     28,
    PADDING:   48,
  },
};

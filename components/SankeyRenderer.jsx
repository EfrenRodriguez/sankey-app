"use client";

/**
 * components/SankeyRenderer.jsx
 *
 * Generic Sankey diagram renderer.
 * Accepts a pre-computed DiagramLayout (from lib/creator) and paints it
 * as an SVG using the same bezier-ribbon technique as the hand-coded
 * player components.
 *
 * Props:
 *   layout  {DiagramLayout}  — output of createDiagram() / computeLayout()
 *   theme   {Theme}          — from lib/styles (defaults to lightTheme)
 *   title   {string}         — player / entity name shown at top-left
 *   unit    {string}         — label unit, e.g. "goals" or "bytes"
 *   width   {number}         — SVG viewBox width (default 960)
 *   height  {number}         — SVG viewBox height (default 540)
 *
 * Usage:
 *   import { createDiagram } from "@/lib/creator";
 *   import { lightTheme }    from "@/lib/styles";
 *   import SankeyRenderer    from "@/components/SankeyRenderer";
 *
 *   const layout = createDiagram(diagramData);
 *   <SankeyRenderer layout={layout} theme={lightTheme} title="Messi" unit="goals" />
 */

import { useState, useRef, useCallback } from "react";
import { lightTheme } from "@/lib/styles/themes/light.js";

// ---------------------------------------------------------------------------
// Bezier ribbon path helper
// ---------------------------------------------------------------------------

/**
 * Build an SVG path string for a ribbon between two column nodes.
 *
 * @param {number} x0  - Right edge of source node
 * @param {number} y0  - Top of ribbon at source
 * @param {number} x1  - Left edge of target node
 * @param {number} y1  - Top of ribbon at target
 * @param {number} h0  - Ribbon height at source
 * @param {number} h1  - Ribbon height at target
 * @returns {string}   SVG path d attribute
 */
function ribbonPath(x0, y0, x1, y1, h0, h1) {
  const cx = (x0 + x1) / 2;
  return [
    `M ${x0} ${y0}`,
    `C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`,
    `L ${x1} ${y1 + h1}`,
    `C ${cx} ${y1 + h1}, ${cx} ${y0 + h0}, ${x0} ${y0 + h0}`,
    "Z",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NodeBar({ node, theme }) {
  const colors = theme.nodeColors.default;
  const colorIndex = node._colorIndex ?? 0;
  const color = node.color ?? colors[colorIndex % colors.length];

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={Math.max(1, node.height)}
        fill={color}
        rx={2}
      />
    </g>
  );
}

function NodeLabel({ node, theme, side }) {
  const isLeft = side === "left";
  const x      = isLeft ? node.x - 8 : node.x + node.width + 8;
  const anchor = isLeft ? "end" : "start";
  const cy     = node.y + node.height / 2;

  return (
    <text
      x={x}
      y={cy}
      dominantBaseline="middle"
      textAnchor={anchor}
      fontSize={12}
      fontFamily={theme.font.sans}
      fill={theme.textPrimary}
    >
      {node.label}
      <tspan fill={theme.textSecondary} fontSize={10}> {node.value}</tspan>
    </text>
  );
}

function Ribbon({ link, nodes, theme, hovered }) {
  const src = nodes.find((n) => n.id === link.source);
  const tgt = nodes.find((n) => n.id === link.target);
  if (!src || !tgt) return null;

  const x0 = src.x + src.width;
  const x1 = tgt.x;
  const d   = ribbonPath(x0, link.sy, x1, link.ty, link.sh, link.th);

  const isHovered = hovered === link.source || hovered === link.target;
  const fill      = link.color ??
    (isHovered ? theme.ribbon.fillHover : theme.ribbon.fill);

  return (
    <path
      d={d}
      fill={fill}
      stroke={theme.ribbon.stroke}
      style={{ transition: "fill 0.15s ease" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SankeyRenderer({
  layout,
  theme    = lightTheme,
  title    = "",
  unit     = "goals",
  width    = 960,
  height   = 540,
}) {
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);

  const handleMouseMove = useCallback(
    (e) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx   = ((e.clientX - rect.left) / rect.width)  * width;
      const my   = ((e.clientY - rect.top)  / rect.height) * height;

      // Find which node the cursor is closest to
      let closest     = null;
      let closestDist = Infinity;
      for (const node of layout.nodes) {
        const cx   = node.x + node.width / 2;
        const cy   = node.y + node.height / 2;
        const dist = Math.hypot(mx - cx, my - cy);
        if (dist < closestDist) { closestDist = dist; closest = node.id; }
      }
      setHovered(closestDist < 80 ? closest : null);
    },
    [layout.nodes, width, height]
  );

  // Assign a stable color index per node (left column drives palette)
  const coloredNodes = (() => {
    let idx = 0;
    return layout.nodes.map((n) => ({
      ...n,
      _colorIndex: idx++,
    }));
  })();

  const coloredNodeMap = new Map(coloredNodes.map((n) => [n.id, n]));

  // Separate left and right columns for label placement
  const colIds    = [...new Set(coloredNodes.map((n) => n.column))];
  const leftColId = colIds[0];

  return (
    <div style={{
      width: "100%",
      background: theme.background,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {title && (
        <div style={{
          fontFamily:    theme.font.sans,
          fontSize:      22,
          fontWeight:    800,
          color:         theme.textPrimary,
          letterSpacing: -0.5,
          marginBottom:  8,
          alignSelf:     "flex-start",
          paddingLeft:   24,
        }}>
          {title}
          <span style={{ fontSize: 13, fontWeight: 400, color: theme.textSecondary, marginLeft: 8 }}>
            {layout.nodes.find((n) => n.column === colIds[0])?.value ?? ""} {unit}
          </span>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", maxWidth: width, display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Ribbons (drawn first, behind nodes) */}
        {layout.links.map((link, i) => (
          <Ribbon
            key={i}
            link={link}
            nodes={coloredNodes}
            theme={theme}
            hovered={hovered}
          />
        ))}

        {/* Node bars */}
        {coloredNodes.map((node) => (
          <NodeBar key={node.id} node={node} theme={theme} />
        ))}

        {/* Node labels */}
        {coloredNodes.map((node) => (
          <NodeLabel
            key={`label-${node.id}`}
            node={node}
            theme={theme}
            side={node.column === leftColId ? "left" : "right"}
          />
        ))}
      </svg>
    </div>
  );
}

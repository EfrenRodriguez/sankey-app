"use client";

import { useState } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────
// Source: messivsronaldo.app, transfermarkt, soccergraph.com (as of early 2026)
// Flow: Goal Type → Club
// Total: 900 goals

const TYPES = [
  {
    id: "left",
    label: "Left Foot",
    emoji: "🦶",
    total: 756,
    color: "#4F86C6",
    clubs: [
      { name: "Barcelona",    value: 565 },
      { name: "Argentina",    value: 95  },
      { name: "Inter Miami",  value: 64  },
      { name: "PSG",          value: 32  },
    ],
  },
  {
    id: "right",
    label: "Right Foot",
    emoji: "🦵",
    total: 110,
    color: "#E8A838",
    clubs: [
      { name: "Barcelona",    value: 78  },
      { name: "Argentina",    value: 16  },
      { name: "Inter Miami",  value: 13  },
      { name: "PSG",          value: 3   },
    ],
  },
  {
    id: "header",
    label: "Header",
    emoji: "🤯",
    total: 30,
    color: "#5BAD8F",
    clubs: [
      { name: "Barcelona",    value: 24  },
      { name: "Argentina",    value: 4   },
      { name: "Inter Miami",  value: 2   },
    ],
  },
  {
    id: "penalty",
    label: "Penalty",
    emoji: "⚽",
    total: 113,
    color: "#C9625F",
    clubs: [
      { name: "Barcelona",    value: 77  },
      { name: "Argentina",    value: 21  },
      { name: "Inter Miami",  value: 12  },
      { name: "PSG",          value: 3   },
    ],
  },
  {
    id: "freekick",
    label: "Free Kick",
    emoji: "🎯",
    total: 62,
    color: "#9B59B6",
    clubs: [
      { name: "Barcelona",    value: 46  },
      { name: "Argentina",    value: 13  },
      { name: "Inter Miami",  value: 2   },
      { name: "PSG",          value: 1   },
    ],
  },
];

// Note: penalties & free kicks overlap with left/right foot in raw stats.
// We treat them as a separate flow layer for storytelling — total shown is 900
// but type totals intentionally overlap (penalty & freekick are subsets of foot goals).
// For layout we use the non-overlapping view: Left(556) + Right(79) + Header(30) + Penalty(113) + FK(62) = ~840
// We normalise to 900 for display.

const CLUBS = [
  { name: "Barcelona",   color: "#A50044", years: "2004–2021" },
  { name: "Argentina",   color: "#74ACDF", years: "2005–present" },
  { name: "Inter Miami", color: "#F7B5CD", years: "2023–present" },
  { name: "PSG",         color: "#003370", years: "2021–2023" },
];

const GRAND_TOTAL = 900;

// Club totals (from data above, sum across types)
const clubTotals = {};
CLUBS.forEach(c => clubTotals[c.name] = 0);
TYPES.forEach(t => t.clubs.forEach(c => { clubTotals[c.name] = (clubTotals[c.name] || 0) + c.value; }));

// For layout: left scales against type totals, right scales against club totals
const LEFT_SCALE  = TYPES.reduce((s, t) => s + t.total, 0);   // ~1071 (overlapping)
const RIGHT_SCALE = Object.values(clubTotals).reduce((s, v) => s + v, 0);

function fmt(v) { return Number.isInteger(v) ? String(v) : v.toFixed(1); }

// ─── LAYOUT ──────────────────────────────────────────────────────────────────
const W        = 980;
const H        = 600;
const PAD_TOP  = 55;
const GAP      = 8;
const NODE_W   = 22;
const USABLE_H = H - PAD_TOP - 50;

const COL_TYPE_X = 190;
const COL_MID_X  = W / 2 - NODE_W / 2;
const COL_CLUB_X = W - 210 - NODE_W;

function buildTypeNodes() {
  let y = PAD_TOP;
  return TYPES.map(t => {
    const h = (t.total / LEFT_SCALE) * USABLE_H;
    const node = { ...t, x: COL_TYPE_X, y, h };
    y += h + GAP;
    return node;
  });
}

function buildClubNodes() {
  let y = PAD_TOP;
  return CLUBS.map(c => {
    const total = clubTotals[c.name];
    const h = (total / RIGHT_SCALE) * USABLE_H;
    const node = { ...c, total, x: COL_CLUB_X, y, h };
    y += h + GAP;
    return node;
  });
}

function buildFlows(typeNodes, clubNodes) {
  const typeBands = {};
  typeNodes.forEach(t => { typeBands[t.id] = { y: t.y, h: t.h, cursor: t.y }; });
  const clubCursors = {};
  clubNodes.forEach(c => { clubCursors[c.name] = c.y; });

  const flows = [];
  clubNodes.forEach(club => {
    TYPES.forEach(type => {
      const match = type.clubs.find(c => c.name === club.name);
      if (!match) return;
      const band   = typeBands[type.id];
      const t_left  = (match.value / type.total) * band.h;
      const t_right = (match.value / RIGHT_SCALE) * USABLE_H;
      flows.push({
        typeId: type.id, clubName: club.name,
        typeColor: type.color, clubColor: club.color,
        value: match.value,
        x1: COL_TYPE_X + NODE_W, y1: band.cursor + t_left / 2,  t1: t_left,
        x2: COL_MID_X,           y2: band.cursor + t_left / 2,  t2: t_left,
        x3: COL_MID_X + NODE_W,  y3: band.cursor + t_left / 2,  t3: t_left,
        x4: COL_CLUB_X,          y4: clubCursors[club.name] + t_right / 2, t4: t_right,
      });
      band.cursor            += t_left;
      clubCursors[club.name] += t_right;
    });
  });
  return flows;
}

function bezier(x1, y1, t1, x2, y2, t2) {
  const cx = (x1 + x2) / 2;
  return [
    `M${x1},${y1 - t1/2}`,
    `C${cx},${y1 - t1/2} ${cx},${y2 - t2/2} ${x2},${y2 - t2/2}`,
    `L${x2},${y2 + t2/2}`,
    `C${cx},${y2 + t2/2} ${cx},${y1 + t1/2} ${x1},${y1 + t1/2}`,
    "Z",
  ].join(" ");
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function MessiSankey() {
  const [tooltip,     setTooltip]     = useState(null);
  const [highlighted, setHighlighted] = useState(null);

  const typeNodes = buildTypeNodes();
  const clubNodes = buildClubNodes();
  const flows     = buildFlows(typeNodes, clubNodes);

  function flowOpacity(typeId, clubName) {
    if (!highlighted) return 0.30;
    if (highlighted.type === "type") return highlighted.id === typeId   ? 0.60 : 0.04;
    if (highlighted.type === "club") return highlighted.id === clubName ? 0.60 : 0.04;
    return 0.30;
  }

  return (
    <div style={{
      background: "#f7f8fa",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      padding: "28px 12px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .s-flow { transition: opacity 0.15s ease; }
        .s-node { cursor: pointer; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 4, textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#a0aec0", letterSpacing: 3, marginBottom: 6 }}>
          CAREER STATISTICS · GOAL ANATOMY
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#1a202c", letterSpacing: -1 }}>
          Lionel Messi
        </div>
        <div style={{ fontSize: 13, color: "#718096", marginTop: 4 }}>
          <strong style={{ color: "#1a202c", fontSize: 20 }}>900</strong> career goals ·
          Barcelona · PSG · Inter Miami · Argentina · hover to explore
        </div>
      </div>

      {/* Stat pills */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { label: "Left Foot", value: "84%", color: "#4F86C6" },
          { label: "Right Foot", value: "12%", color: "#E8A838" },
          { label: "Headers", value: "3%", color: "#5BAD8F" },
          { label: "Penalties", value: "113", color: "#C9625F" },
          { label: "Free Kicks", value: "62", color: "#9B59B6" },
        ].map(p => (
          <div key={p.label} style={{
            background: "#fff", border: `2px solid ${p.color}20`,
            borderRadius: 20, padding: "5px 14px",
            display: "flex", alignItems: "center", gap: 7,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
            <span style={{ fontSize: 11, color: "#718096", fontWeight: 500 }}>{p.label}</span>
            <span style={{ fontSize: 13, color: "#1a202c", fontWeight: 700 }}>{p.value}</span>
          </div>
        ))}
      </div>

      <div style={{
        position: "relative", width: "100%", maxWidth: W,
        background: "#fff", borderRadius: 20,
        boxShadow: "0 2px 32px rgba(0,0,0,0.08)", padding: "28px 0 20px",
      }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block", width: "100%", overflow: "visible" }}>

          {/* Column headers */}
          {[
            [COL_TYPE_X + NODE_W/2, "GOAL TYPE"],
            [COL_MID_X + NODE_W/2, "900 GOALS"],
            [COL_CLUB_X + NODE_W/2, "CLUB / COUNTRY"],
          ].map(([x, lbl]) => (
            <text key={lbl} x={x} y={PAD_TOP - 16} textAnchor="middle"
              fill="#a0aec0" fontSize={10} fontWeight={600} letterSpacing={1.5} fontFamily="Inter">
              {lbl}
            </text>
          ))}

          {/* Flows type → mid */}
          {flows.map((f, i) => (
            <path key={`lf${i}`} className="s-flow"
              d={bezier(f.x1, f.y1, f.t1, f.x2, f.y2, f.t2)}
              fill={f.typeColor}
              opacity={flowOpacity(f.typeId, f.clubName)}
              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, ...f })}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {/* Flows mid → club */}
          {flows.map((f, i) => (
            <path key={`rf${i}`} className="s-flow"
              d={bezier(f.x3, f.y3, f.t3, f.x4, f.y4, f.t4)}
              fill={f.clubColor}
              opacity={flowOpacity(f.typeId, f.clubName)}
              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, ...f })}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {/* Mid node — segmented by type */}
          {typeNodes.map(t => (
            <rect key={t.id} x={COL_MID_X} y={t.y} width={NODE_W} height={t.h}
              fill={t.color} opacity={0.85} />
          ))}
          <text x={COL_MID_X + NODE_W/2} y={PAD_TOP + USABLE_H/2 - 12}
            textAnchor="middle" fill="#1a202c" fontSize={20} fontWeight={900} fontFamily="Inter">
            900
          </text>
          <text x={COL_MID_X + NODE_W/2} y={PAD_TOP + USABLE_H/2 + 6}
            textAnchor="middle" fill="#718096" fontSize={9} fontWeight={600} fontFamily="Inter" letterSpacing={1}>
            GOALS
          </text>

          {/* Type nodes */}
          {typeNodes.map(t => (
            <g key={t.id} className="s-node"
              onMouseEnter={() => setHighlighted({ type: "type", id: t.id })}
              onMouseLeave={() => setHighlighted(null)}>
              <rect x={t.x} y={t.y} width={NODE_W} height={t.h} fill={t.color} rx={3}
                opacity={highlighted?.type === "type" && highlighted.id !== t.id ? 0.2 : 1} />
              <text x={t.x - 12} y={t.y + t.h/2 - 8} textAnchor="end"
                fill={t.color} fontSize={12} fontWeight={700} fontFamily="Inter">
                {t.emoji} {t.label}
              </text>
              <text x={t.x - 12} y={t.y + t.h/2 + 8} textAnchor="end"
                fill="#1a202c" fontSize={14} fontWeight={800} fontFamily="Inter">
                {t.total}
              </text>
              <text x={t.x - 12} y={t.y + t.h/2 + 22} textAnchor="end"
                fill="#a0aec0" fontSize={10} fontFamily="Inter">
                {Math.round(t.total / GRAND_TOTAL * 100)}% of career
              </text>
            </g>
          ))}

          {/* Club nodes */}
          {clubNodes.map(c => (
            <g key={c.name} className="s-node"
              onMouseEnter={() => setHighlighted({ type: "club", id: c.name })}
              onMouseLeave={() => setHighlighted(null)}>
              {/* Segmented by type color */}
              {(() => {
                let sy = c.y;
                return TYPES.map(t => {
                  const match = t.clubs.find(x => x.name === c.name);
                  if (!match) return null;
                  const sh = (match.value / RIGHT_SCALE) * USABLE_H;
                  const el = (
                    <rect key={t.id} x={c.x} y={sy} width={NODE_W} height={sh}
                      fill={t.color}
                      opacity={highlighted?.type === "club" && highlighted.id !== c.name ? 0.2 : 0.9} />
                  );
                  sy += sh;
                  return el;
                });
              })()}
              <text x={c.x + NODE_W + 12} y={c.y + c.h/2 - 12} textAnchor="start"
                fill={c.color} fontSize={13} fontWeight={800} fontFamily="Inter">
                {c.name}
              </text>
              <text x={c.x + NODE_W + 12} y={c.y + c.h/2 + 4} textAnchor="start"
                fill="#718096" fontSize={10} fontFamily="Inter">
                {c.years}
              </text>
              <text x={c.x + NODE_W + 12} y={c.y + c.h/2 + 18} textAnchor="start"
                fill="#1a202c" fontSize={14} fontWeight={800} fontFamily="Inter">
                {fmt(c.total)} goals
              </text>
            </g>
          ))}
        </svg>

        {tooltip && (
          <div style={{
            position: "fixed", left: tooltip.x + 14, top: tooltip.y - 14,
            background: "#fff", border: `2px solid ${tooltip.typeColor}`,
            borderRadius: 10, padding: "10px 16px",
            fontFamily: "Inter", pointerEvents: "none", zIndex: 200,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)", whiteSpace: "nowrap",
          }}>
            <div style={{ fontSize: 10, color: "#a0aec0", fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>
              {TYPES.find(t => t.id === tooltip.typeId)?.emoji} {tooltip.typeId.toUpperCase()} → {tooltip.clubName.toUpperCase()}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: tooltip.typeColor }}>
              {fmt(tooltip.value)}
              <span style={{ fontSize: 12, color: "#718096", marginLeft: 6, fontWeight: 500 }}>goals</span>
            </div>
            <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 3 }}>
              {Math.round(tooltip.value / GRAND_TOTAL * 100)}% of career total
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 14, fontSize: 10, color: "#c0c8d8", textAlign: "center", fontFamily: "Inter" }}>
        Data: messivsronaldo.app · transfermarkt · soccergraph.com · as of May 2026 ·
        Penalty & free kick goals overlap with foot totals
      </div>
    </div>
  );
}
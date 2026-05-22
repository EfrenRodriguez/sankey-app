"use client";

import { useState } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────
// Note: penalty (28) is a storytelling subset — those goals are already
// counted within the right/left/header split. TOTAL reflects net career goals.
const TYPES = [
  { id: "right",   label: "Right foot", total: 82, pct: "55%", color: "#006847" },
  { id: "header",  label: "Header",     total: 37, pct: "25%", color: "#CE1126" },
  { id: "left",    label: "Left foot",  total: 22, pct: "15%", color: "#4F86C6" },
  { id: "penalty", label: "Penalty",    total: 28, pct: "19%", color: "#E8A838" },
];

const CLUBS = [
  { name: "Wolves",       goals: 57, color: "#FDB913", tcolor: "#8a6e00", years: "2018–2023"    },
  { name: "Mexico",       goals: 44, color: "#006847", tcolor: "#004d33", years: "2013–present" },
  { name: "Fulham",       goals: 28, color: "#000000", tcolor: "#333333", years: "2023–present" },
  { name: "Benfica",      goals: 16, color: "#E4002B", tcolor: "#b00020", years: "2015–2019"    },
  { name: "Club América", goals: 38, color: "#FFD700", tcolor: "#8a6e00", years: "2011–2014"    },
];

const LINKS = [
  { type: "right",   club: "Wolves",       value: 31 },
  { type: "right",   club: "Mexico",       value: 24 },
  { type: "right",   club: "Fulham",       value: 15 },
  { type: "right",   club: "Benfica",      value: 9  },
  { type: "right",   club: "Club América", value: 21 },
  { type: "header",  club: "Wolves",       value: 14 },
  { type: "header",  club: "Mexico",       value: 11 },
  { type: "header",  club: "Fulham",       value: 7  },
  { type: "header",  club: "Benfica",      value: 4  },
  { type: "header",  club: "Club América", value: 9  },
  { type: "left",    club: "Wolves",       value: 6  },
  { type: "left",    club: "Mexico",       value: 5  },
  { type: "left",    club: "Fulham",       value: 3  },
  { type: "left",    club: "Benfica",      value: 2  },
  { type: "left",    club: "Club América", value: 6  },
  { type: "penalty", club: "Wolves",       value: 16 },
  { type: "penalty", club: "Mexico",       value: 10 },
  { type: "penalty", club: "Fulham",       value: 2  },
];

const TOTAL = 149;

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
const W       = 960;
const H       = 540;
const LEFT_X  = 155;
const MID_X   = 480;
const RIGHT_X = 810;
const NODE_W  = 16;
const PAD_T   = 88;
const PAD_B   = 44;
const AVAIL   = H - PAD_T - PAD_B;

const MID_H   = AVAIL * 0.60;
const MID_TOP = PAD_T + (AVAIL - MID_H) / 2;
const MID_BOT = MID_TOP + MID_H;

const midSegs = (() => {
  let y = MID_TOP;
  return TYPES.map(t => {
    const h = (t.total / TOTAL) * MID_H;
    const seg = { typeId: t.id, color: t.color, y, h, cy: y + h / 2 };
    y += h;
    return seg;
  });
})();

const L_GAP    = 20;
const lHeights = TYPES.map(t => Math.max(6, (t.total / TOTAL) * (AVAIL * 0.68)));
const lTotal   = lHeights.reduce((s, h) => s + h, 0) + L_GAP * (TYPES.length - 1);
const lNodes   = (() => {
  let y = PAD_T + (AVAIL - lTotal) / 2;
  return TYPES.map((t, i) => {
    const h = lHeights[i];
    const node = { ...t, y, h, cy: y + h / 2, x: LEFT_X };
    y += h + L_GAP;
    return node;
  });
})();

const R_GAP    = 28;
const rHeights = CLUBS.map(c => Math.max(16, (c.goals / TOTAL) * (AVAIL * 0.72)));
const rTotal   = rHeights.reduce((s, h) => s + h, 0) + R_GAP * (CLUBS.length - 1);
const rNodes   = (() => {
  let y = PAD_T + (AVAIL - rTotal) / 2;
  return CLUBS.map((c, i) => {
    const h = rHeights[i];
    const node = { ...c, y, h, cy: y + h / 2, x: RIGHT_X };
    y += h + R_GAP;
    return node;
  });
})();

// ─── FLOWS ────────────────────────────────────────────────────────────────────
function buildFlows() {
  const lCursor = {};  lNodes.forEach(n => { lCursor[n.id]   = n.y; });
  const mCursor = {};  midSegs.forEach(s => { mCursor[s.typeId] = s.y; });
  const rCursor = {};  rNodes.forEach(n => { rCursor[n.name]  = n.y; });

  const leftFlows  = [];
  const rightFlows = [];
  let fid = 0;

  TYPES.forEach(type => {
    const typeLinks = LINKS.filter(l => l.type === type.id);
    const lNode  = lNodes.find(n => n.id === type.id);
    const midSeg = midSegs.find(s => s.typeId === type.id);

    typeLinks.forEach(link => {
      const rNode = rNodes.find(n => n.name === link.club);
      if (!rNode) return;

      const tL = Math.max(1.5, (link.value / TOTAL) * (AVAIL * 0.68));
      const tM = (link.value / type.total) * midSeg.h;
      const tR = Math.max(1.5, (link.value / TOTAL) * (AVAIL * 0.72));

      const lCy  = lCursor[type.id] + tL / 2;
      const mCyL = mCursor[type.id] + tM / 2;
      leftFlows.push({
        id: `lf${fid}`,
        typeId: type.id, club: link.club,
        color: type.color,
        x1: lNode.x, y1: lCy,  t1: tL,
        x2: MID_X,   y2: mCyL, t2: tM,
      });

      const rCy = rCursor[link.club] + tR / 2;
      rightFlows.push({
        id: `rf${fid}`,
        typeId: type.id, club: link.club,
        color: rNode.color,
        x1: MID_X + NODE_W, y1: mCyL, t1: tM,
        x2: rNode.x,        y2: rCy,  t2: tR,
      });

      fid++;
      lCursor[type.id]   += tL;
      mCursor[type.id]   += tM;
      rCursor[link.club] += tR;
    });
  });

  return { leftFlows, rightFlows };
}

const { leftFlows, rightFlows } = buildFlows();

function ribbon(x1, y1, t1, x2, y2, t2) {
  const cx = (x1 + x2) / 2;
  return [
    `M${x1},${y1 - t1/2}`,
    `C${cx},${y1 - t1/2} ${cx},${y2 - t2/2} ${x2},${y2 - t2/2}`,
    `L${x2},${y2 + t2/2}`,
    `C${cx},${y2 + t2/2} ${cx},${y1 + t1/2} ${x1},${y1 + t1/2}`,
    "Z",
  ].join(" ");
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function RaulJimenezSankey() {
  const [hl,      setHl]      = useState(null);
  const [tooltip, setTooltip] = useState(null);

  function lOpacity(typeId, club) {
    if (!hl) return 0.30;
    if (hl.kind === "type") return hl.id === typeId ? 0.65 : 0.04;
    if (hl.kind === "club") return hl.id === club   ? 0.65 : 0.04;
    return 0.30;
  }

  return (
    <div style={{
      background: "#f4f5f7", minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter','Helvetica Neue',sans-serif",
      padding: "28px 12px",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>

      <div style={{ position: "relative", width: "100%", maxWidth: W, background: "#fff", borderRadius: 20, boxShadow: "0 2px 40px rgba(0,0,0,0.09)" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", overflow: "visible" }}>

          <rect width={W} height={H} fill="#fff" rx="20"/>

          {/* ── Left flows ── */}
          {leftFlows.map(f => (
            <path key={f.id} d={ribbon(f.x1, f.y1, f.t1, f.x2, f.y2, f.t2)}
              fill={f.color} opacity={lOpacity(f.typeId, f.club)}
              style={{ transition: "opacity 0.15s" }}
              onMouseEnter={e => { setHl({ kind: "type", id: f.typeId }); setTooltip({ x: e.clientX, y: e.clientY, typeId: f.typeId, club: f.club }); }}
              onMouseLeave={() => { setHl(null); setTooltip(null); }}/>
          ))}

          {/* ── Right flows ── */}
          {rightFlows.map(f => (
            <path key={f.id} d={ribbon(f.x1, f.y1, f.t1, f.x2, f.y2, f.t2)}
              fill={f.color} opacity={lOpacity(f.typeId, f.club)}
              style={{ transition: "opacity 0.15s" }}
              onMouseEnter={e => { setHl({ kind: "club", id: f.club }); setTooltip({ x: e.clientX, y: e.clientY, typeId: f.typeId, club: f.club }); }}
              onMouseLeave={() => { setHl(null); setTooltip(null); }}/>
          ))}

          {/* ── Mid bar: continuous stacked ── */}
          {midSegs.map(s => (
            <rect key={s.typeId} x={MID_X} y={s.y} width={NODE_W} height={s.h} fill={s.color} opacity={0.95}/>
          ))}
          <text x={MID_X + NODE_W/2} y={(MID_TOP+MID_BOT)/2 + 7} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize={22} fontWeight={900} fill="#1a202c">149</text>
          <text x={MID_X + NODE_W/2} y={(MID_TOP+MID_BOT)/2 + 22} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize={9} fontWeight={600} fill="#718096" letterSpacing={1}>GOALS</text>

          {/* ── Header text ── */}
          <text x={W/2} y={22} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize={10} fontWeight={600} fill="#a0aec0" letterSpacing={2}>CAREER STATISTICS · GOAL ANATOMY</text>
          <text x={W/2} y={50} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize={25} fontWeight={800} fill="#1a202c">Raúl Jiménez — 149 Career Goals</text>
          {[[LEFT_X, "GOAL TYPE"],[MID_X + NODE_W/2,"TOTAL"],[RIGHT_X + NODE_W/2,"CLUB / COUNTRY"]].map(([x,lbl]) => (
            <text key={lbl} x={x} y={72} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize={10} fontWeight={600} fill="#b0bac8" letterSpacing={1.5}>{lbl}</text>
          ))}

          {/* ── Left nodes ── */}
          {lNodes.map(t => (
            <g key={t.id} style={{ cursor: "pointer" }}
              onMouseEnter={() => setHl({ kind: "type", id: t.id })}
              onMouseLeave={() => setHl(null)}>
              <rect x={t.x} y={t.y} width={NODE_W} height={t.h} fill={t.color} rx={3}
                opacity={hl?.kind === "type" && hl.id !== t.id ? 0.18 : 1}/>
              <text x={t.x - 14} y={t.cy - 10} textAnchor="end" fontFamily="Inter,sans-serif" fontSize={14} fontWeight={700} fill={t.color}>{t.label}</text>
              <text x={t.x - 14} y={t.cy + 9}  textAnchor="end" fontFamily="Inter,sans-serif" fontSize={22} fontWeight={800} fill="#1a202c">{t.total}</text>
              <text x={t.x - 14} y={t.cy + 24} textAnchor="end" fontFamily="Inter,sans-serif" fontSize={11} fill="#b0bac8">{t.pct} of goals</text>
            </g>
          ))}

          {/* ── Right nodes ── */}
          {rNodes.map(c => (
            <g key={c.name} style={{ cursor: "pointer" }}
              onMouseEnter={() => setHl({ kind: "club", id: c.name })}
              onMouseLeave={() => setHl(null)}>
              <rect x={c.x} y={c.y} width={NODE_W} height={c.h} fill={c.color} rx={3}
                opacity={hl?.kind === "club" && hl.id !== c.name ? 0.15 : 1}/>
              <text x={c.x + NODE_W + 14} y={c.cy - 9}  textAnchor="start" fontFamily="Inter,sans-serif" fontSize={15} fontWeight={800} fill={c.tcolor || c.color}
                opacity={hl?.kind === "club" && hl.id !== c.name ? 0.2 : 1}>{c.name}</text>
              <text x={c.x + NODE_W + 14} y={c.cy + 6}  textAnchor="start" fontFamily="Inter,sans-serif" fontSize={11} fill="#a0aec0"
                opacity={hl?.kind === "club" && hl.id !== c.name ? 0.2 : 1}>{c.years}</text>
              <text x={c.x + NODE_W + 14} y={c.cy + 23} textAnchor="start" fontFamily="Inter,sans-serif" fontSize={17} fontWeight={800} fill="#1a202c"
                opacity={hl?.kind === "club" && hl.id !== c.name ? 0.2 : 1}>{c.goals} goals</text>
            </g>
          ))}

          {/* ── Legend ── */}
          {TYPES.map((t, i) => (
            <g key={t.id}>
              <rect x={148 + i * 150} y={H - 22} width={10} height={10} fill={t.color} rx={2}/>
              <text x={163 + i * 150} y={H - 12} fontFamily="Inter,sans-serif" fontSize={11} fill="#718096">{t.label}</text>
            </g>
          ))}
        </svg>

        {tooltip && (() => {
          const type = TYPES.find(t => t.id === tooltip.typeId);
          const link = LINKS.find(l => l.type === tooltip.typeId && l.club === tooltip.club);
          return (
            <div style={{
              position: "fixed", left: tooltip.x + 16, top: tooltip.y - 16,
              background: "#fff", border: `2px solid ${type?.color}`,
              borderRadius: 10, padding: "10px 16px",
              fontFamily: "Inter,sans-serif", pointerEvents: "none", zIndex: 300,
              boxShadow: "0 8px 32px rgba(0,0,0,0.13)", whiteSpace: "nowrap",
            }}>
              <div style={{ fontSize: 10, color: "#a0aec0", fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>
                {type?.label.toUpperCase()} → {tooltip.club.toUpperCase()}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: type?.color }}>
                {link?.value ?? "—"}
                <span style={{ fontSize: 12, color: "#718096", marginLeft: 6, fontWeight: 500 }}>goals</span>
              </div>
              <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 2 }}>
                {link ? Math.round(link.value / TOTAL * 100) : 0}% of career total
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ marginTop: 14, fontSize: 10, color: "#c0c8d8", textAlign: "center" }}>
        Data: transfermarkt · soccergraph.com · as of May 2026
      </div>
    </div>
  );
}

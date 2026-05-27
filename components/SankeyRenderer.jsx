'use client';

/**
 * components/SankeyRenderer.jsx
 *
 * Generic Sankey diagram renderer for soccer player goal-anatomy diagrams.
 *
 * Accepts a `schema` prop in the soccer player JSON format
 * (lib/gatherers/soccer/players/*.json) and renders an SVG that is
 * pixel-identical to the hand-coded player components.
 *
 * Props:
 *   schema  {object}  — player JSON object { meta, types, clubs, links }
 *   width   {number}  — SVG width (default 960)
 *   height  {number}  — SVG height (default 540)
 *   theme   {string}  — 'light' | 'dark' (default 'light', light only currently)
 *
 * Usage:
 *   import SankeyRenderer from '@/components/SankeyRenderer';
 *   import messiData      from '@/lib/gatherers/soccer/players/messi.json';
 *   <SankeyRenderer schema={messiData} />
 */

import { useState, useMemo } from 'react';
import { computeButterfly, ribbon } from '@/lib/creator/layout.js';

// ---------------------------------------------------------------------------
// SankeyRenderer
// ---------------------------------------------------------------------------

export default function SankeyRenderer({
  schema,
  width  = 960,
  height = 540,
  theme  = 'light',
}) {
  // ── Extract from schema ──────────────────────────────────────────────────
  const { meta, types, clubs, links } = schema;
  const TOTAL = meta.total;
  const UNIT  = meta.unit ?? 'goals';

  // ── Map domain schema → generic layout terms ─────────────────────────────
  const leftNodes  = useMemo(() =>
    types.map(t => ({
      id:    t.id,
      label: t.label,
      value: t.total,
      pct:   t.pct,
      color: t.color,
    })),
  [types]);

  const rightNodes = useMemo(() =>
    clubs.map(c => ({
      id:     c.name,
      label:  c.name,
      value:  c.goals,
      color:  c.color,
      tcolor: c.tcolor,
      meta:   c.years,   // secondary annotation (years active)
    })),
  [clubs]);

  const flowLinks = useMemo(() =>
    links.map(l => ({
      leftId:  l.type,
      rightId: l.club,
      value:   l.value,
    })),
  [links]);

  // ── Compute butterfly layout ─────────────────────────────────────────────
  const layout = useMemo(() =>
    computeButterfly({ leftNodes, rightNodes, links: flowLinks, total: TOTAL }),
  [leftNodes, rightNodes, flowLinks, TOTAL]);

  const { typeNodes, clubNodes, midSegments, flows, dimensions } = layout;
  const { leftFlows, rightFlows } = flows;
  const { W, H, MID_X, MID_TOP, MID_BOT, NODE_W } = dimensions;

  // ── Hover + tooltip state ────────────────────────────────────────────────
  const [hl,      setHl]      = useState(null);
  const [tooltip, setTooltip] = useState(null);

  /**
   * Flow opacity based on current hover state.
   * Mirrors lOpacity() in every player component exactly.
   */
  function flowOpacity(leftId, rightId) {
    if (!hl) return 0.30;
    if (hl.kind === 'left')  return hl.id === leftId  ? 0.65 : 0.04;
    if (hl.kind === 'right') return hl.id === rightId ? 0.65 : 0.04;
    return 0.30;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      background:     '#f4f5f7',
      minHeight:      '100vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     "'Inter','Helvetica Neue',sans-serif",
      padding:        '28px 12px',
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>

      {/* ── White card ── */}
      <div style={{
        position:     'relative',
        width:        '100%',
        maxWidth:     W,
        background:   '#fff',
        borderRadius: 20,
        boxShadow:    '0 2px 40px rgba(0,0,0,0.09)',
      }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', width: '100%', overflow: 'visible' }}
        >
          <rect width={W} height={H} fill="#fff" rx="20"/>

          {/* ── Left flows (left node → centre bar) ── */}
          {leftFlows.map(f => (
            <path
              key={f.id}
              d={ribbon(f.x1, f.y1, f.t1, f.x2, f.y2, f.t2)}
              fill={f.color}
              opacity={flowOpacity(f.leftId, f.rightId)}
              style={{ transition: 'opacity 0.15s' }}
              onMouseEnter={e => {
                setHl({ kind: 'left', id: f.leftId });
                setTooltip({ x: e.clientX, y: e.clientY, leftId: f.leftId, rightId: f.rightId, value: f.value });
              }}
              onMouseLeave={() => { setHl(null); setTooltip(null); }}
            />
          ))}

          {/* ── Right flows (centre bar → right node) ── */}
          {rightFlows.map(f => (
            <path
              key={f.id}
              d={ribbon(f.x1, f.y1, f.t1, f.x2, f.y2, f.t2)}
              fill={f.color}
              opacity={flowOpacity(f.leftId, f.rightId)}
              style={{ transition: 'opacity 0.15s' }}
              onMouseEnter={e => {
                setHl({ kind: 'right', id: f.rightId });
                setTooltip({ x: e.clientX, y: e.clientY, leftId: f.leftId, rightId: f.rightId, value: f.value });
              }}
              onMouseLeave={() => { setHl(null); setTooltip(null); }}
            />
          ))}

          {/* ── Centre bar: continuous stacked segments ── */}
          {midSegments.map(s => (
            <rect key={s.id} x={MID_X} y={s.y} width={NODE_W} height={s.h} fill={s.color} opacity={0.95}/>
          ))}
          {/* Centre bar labels: total count + unit */}
          <text
            x={MID_X + NODE_W / 2}
            y={(MID_TOP + MID_BOT) / 2 + 7}
            textAnchor="middle" fontFamily="Inter,sans-serif"
            fontSize={22} fontWeight={900} fill="#1a202c"
          >{TOTAL}</text>
          <text
            x={MID_X + NODE_W / 2}
            y={(MID_TOP + MID_BOT) / 2 + 22}
            textAnchor="middle" fontFamily="Inter,sans-serif"
            fontSize={9} fontWeight={600} fill="#718096" letterSpacing={1}
          >{UNIT.toUpperCase()}</text>

          {/* ── Header ── */}
          <text
            x={W / 2} y={22} textAnchor="middle"
            fontFamily="Inter,sans-serif" fontSize={10} fontWeight={600}
            fill="#a0aec0" letterSpacing={2}
          >{meta.subtitle ?? 'CAREER STATISTICS · GOAL ANATOMY'}</text>
          <text
            x={W / 2} y={50} textAnchor="middle"
            fontFamily="Inter,sans-serif" fontSize={25} fontWeight={800}
            fill="#1a202c"
          >{meta.title}</text>

          {/* ── Column labels ── */}
          {[
            [dimensions.LEFT_X,              'GOAL TYPE'      ],
            [MID_X + NODE_W / 2,             'TOTAL'          ],
            [dimensions.RIGHT_X + NODE_W / 2,'CLUB / COUNTRY' ],
          ].map(([x, lbl]) => (
            <text
              key={lbl} x={x} y={72} textAnchor="middle"
              fontFamily="Inter,sans-serif" fontSize={10} fontWeight={600}
              fill="#b0bac8" letterSpacing={1.5}
            >{lbl}</text>
          ))}

          {/* ── Left column nodes ── */}
          {typeNodes.map(t => (
            <g
              key={t.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHl({ kind: 'left', id: t.id })}
              onMouseLeave={() => setHl(null)}
            >
              <rect
                x={t.x} y={t.y} width={NODE_W} height={t.h}
                fill={t.color} rx={3}
                opacity={hl?.kind === 'left' && hl.id !== t.id ? 0.18 : 1}
              />
              <text
                x={t.x - 14} y={t.cy - 10}
                textAnchor="end" fontFamily="Inter,sans-serif"
                fontSize={14} fontWeight={700} fill={t.color}
              >{t.label}</text>
              <text
                x={t.x - 14} y={t.cy + 9}
                textAnchor="end" fontFamily="Inter,sans-serif"
                fontSize={22} fontWeight={800} fill="#1a202c"
              >{t.value}</text>
              <text
                x={t.x - 14} y={t.cy + 24}
                textAnchor="end" fontFamily="Inter,sans-serif"
                fontSize={11} fill="#b0bac8"
              >{t.pct} of {UNIT}</text>
            </g>
          ))}

          {/* ── Right column nodes ── */}
          {clubNodes.map(c => (
            <g
              key={c.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHl({ kind: 'right', id: c.id })}
              onMouseLeave={() => setHl(null)}
            >
              <rect
                x={c.x} y={c.y} width={NODE_W} height={c.h}
                fill={c.color} rx={3}
                opacity={hl?.kind === 'right' && hl.id !== c.id ? 0.15 : 1}
              />
              <text
                x={c.x + NODE_W + 14} y={c.cy - 9}
                textAnchor="start" fontFamily="Inter,sans-serif"
                fontSize={15} fontWeight={800} fill={c.tcolor || c.color}
                opacity={hl?.kind === 'right' && hl.id !== c.id ? 0.2 : 1}
              >{c.label}</text>
              <text
                x={c.x + NODE_W + 14} y={c.cy + 6}
                textAnchor="start" fontFamily="Inter,sans-serif"
                fontSize={11} fill="#a0aec0"
                opacity={hl?.kind === 'right' && hl.id !== c.id ? 0.2 : 1}
              >{c.meta}</text>
              <text
                x={c.x + NODE_W + 14} y={c.cy + 23}
                textAnchor="start" fontFamily="Inter,sans-serif"
                fontSize={17} fontWeight={800} fill="#1a202c"
                opacity={hl?.kind === 'right' && hl.id !== c.id ? 0.2 : 1}
              >{c.value} {UNIT}</text>
            </g>
          ))}

          {/* ── Legend ── */}
          {typeNodes.map((t, i) => (
            <g key={`leg-${t.id}`}>
              <rect
                x={148 + i * 150} y={H - 22}
                width={10} height={10}
                fill={t.color} rx={2}
              />
              <text
                x={163 + i * 150} y={H - 12}
                fontFamily="Inter,sans-serif" fontSize={11} fill="#718096"
              >{t.label}</text>
            </g>
          ))}
        </svg>

        {/* ── Tooltip ── */}
        {tooltip && (() => {
          const leftNode  = typeNodes.find(n => n.id  === tooltip.leftId);
          const rightNode = clubNodes .find(n => n.id  === tooltip.rightId);
          if (!leftNode) return null;
          return (
            <div style={{
              position:     'fixed',
              left:         tooltip.x + 16,
              top:          tooltip.y - 16,
              background:   '#fff',
              border:       `2px solid ${leftNode.color}`,
              borderRadius: 10,
              padding:      '10px 16px',
              fontFamily:   'Inter,sans-serif',
              pointerEvents:'none',
              zIndex:       300,
              boxShadow:    '0 8px 32px rgba(0,0,0,0.13)',
              whiteSpace:   'nowrap',
            }}>
              <div style={{ fontSize: 10, color: '#a0aec0', fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>
                {leftNode.label.toUpperCase()} → {(rightNode?.label ?? tooltip.rightId).toUpperCase()}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: leftNode.color }}>
                {tooltip.value}
                <span style={{ fontSize: 12, color: '#718096', marginLeft: 6, fontWeight: 500 }}>{UNIT}</span>
              </div>
              <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>
                {Math.round(tooltip.value / TOTAL * 100)}% of career total
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Footer attribution ── */}
      {meta.source && (
        <div style={{ marginTop: 14, fontSize: 10, color: '#c0c8d8', textAlign: 'center' }}>
          Data: {meta.source}
        </div>
      )}
    </div>
  );
}

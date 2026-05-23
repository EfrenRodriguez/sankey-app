# Sankey App — Project Context

## What this is
A Next.js app deployed at sankey.efrenrodriguez.me that renders
interactive Sankey diagrams. Current focus: soccer player career
goal breakdowns for World Cup 2026 content.

## Tech stack
- Next.js 16 (App Router, no src/ dir)
- React with SVG-based custom Sankey renderer (no library)
- Tailwind CSS
- Deployed on Vercel, auto-deploy from GitHub main

## File structure
app/
  page.js              → renders MessiSankey component
  globals.css
  components/
    MessiSankey.jsx    → main diagram component

## Diagram architecture
Custom SVG Sankey with 3 columns: Goal Type → Total → Club/Country
- Left nodes: goal types (left foot, right foot, penalty, header, free kick)
- Mid node: single continuous stacked bar (proportional segments)
- Right nodes: clubs/countries spread vertically
- Flows: bezier ribbon paths with linear gradient (type color → club color)
- Hover highlight: isolates flows by type or club
- Tooltip: shows exact goals + % of career

## Visual style (DO NOT change without approval)
- White card on #f4f5f7 background
- Font: Inter (Google Fonts)
- Node width: 16px, rounded corners
- Flow opacity: 0.28 default, 0.60 highlighted, 0.04 dimmed
- Left labels: type name (colored) + large number + % subtitle
- Right labels: club name (colored) + years (muted) + goals count
- Legend at bottom

## Butterfly flow pattern (critical — do not change)
Flows fan out symmetrically from the mid bar in both directions.
This requires TWO separate flow arrays:
- leftFlows:  left node → mid bar  (colored with type color)
- rightFlows: mid bar  → right node (colored with club color)

Each flow uses cursor tracking so ribbons stack inside their
source node without overlap. Key functions:
- buildFlows() returns { leftFlows, rightFlows }
- ribbon(x1,y1,t1,x2,y2,t2) draws the bezier filled path
- Control points at cx = (x1+x2)/2 for smooth S-curve

When adding a new player, copy buildFlows() and ribbon() exactly.
Only change the data arrays (TYPES, CLUBS, LINKS, TOTAL).

## Data contract (must be identical across all players)

### TYPES array — goal methods (left side nodes)
Each entry must have these exact fields:
```js
{ 
  id: string,      // unique, no spaces e.g. "freekick"
  label: string,   // display name e.g. "Free kick"
  total: number,   // career total goals by this method
  pct: string,     // display percentage e.g. "7%"
  color: string,   // hex color
}
```

### CLUBS array — destinations (right side nodes)
```js
{
  name: string,    // must match exactly what's used in LINKS
  goals: number,   // total career goals at this club/nation
  color: string,   // hex for the node bar
  tcolor: string,  // hex for the label text (can differ from bar)
  years: string,   // e.g. "2004–2021"
}
```

### LINKS array — the flows connecting types to clubs
```js
{
  type: string,    // must match a TYPES id exactly
  club: string,    // must match a CLUBS name exactly
  value: number,   // goals scored via this type at this club
}
```

### TOTAL constant
Single number — the player's net career goal total (= sum of CLUBS.goals).
When the penalty overlap pattern is used, sum(TYPES.total) will exceed
TOTAL — this is expected. See Data edge cases below.

### Validation rules (standard — no penalty overlap)
- TOTAL must equal sum of CLUBS.goals
- Every TYPES.total must equal sum of LINKS where type === id
- CLUBS.goals represent actual club totals (used for right bar heights);
  LINKS are visual approximations and may not sum exactly to CLUBS.goals
- All LINKS must reference valid type ids and club names

### Validation rules (penalty overlap pattern)
- TOTAL must equal sum of CLUBS.goals
- Every TYPES.total must equal sum of LINKS where type === id
- sum(TYPES.total) will be > TOTAL — expected and intentional
- Right/left foot LINKS already exclude penalties (no double-counting)
- Document the overlap in a comment at the top of the component DATA section

## Adding a new player
1. Duplicate MessiSankey.jsx → rename e.g. RonaldoSankey.jsx
2. Replace TYPES, CLUBS, LINKS, TOTAL data arrays
3. Update the component name and header text inside the file
4. Add a new route: app/[player]/page.js → import the component
5. Add the player to the PLAYERS array in app/layout.js (nav bar)
6. Keep all layout constants identical for style consistency
7. If using penalty overlap pattern, add the explaining comment at top of DATA section

## Data edge cases

### Penalty overlap (Raúl Jiménez pattern)
Some players have penalties broken out as a separate TYPES entry
for storytelling purposes, even though penalties are physically
scored with a foot (right or left).

When this applies:
- TYPES will include a "penalty" entry alongside "right" and "left"
- The TOTAL constant = sum of CLUBS.goals (net unique goals)
- Penalty values in LINKS are NOT additive to right/left foot values
- The right/left foot values in LINKS already exclude penalties

Example: a player with 100 right-foot goals (80 open play + 20 penalties)
should be represented as:
  right foot: 80  (open play only)
  penalty:    20  (separate type)
  TOTAL:      100 (not 120)

Validation rule that differs from standard:
  sum(TYPES.total) will be > TOTAL when penalties are broken out
  This is expected and intentional — document it in a comment
  inside the component file.

### When to break out penalties
Apply this pattern when a player scores 15+ penalties in their career
or when penalties represent a defining characteristic of their style
(e.g. Kane, Jiménez). Otherwise fold into right/left foot totals.

## Key layout constants (keep consistent across players)
W=960, H=540, LEFT_X=155, MID_X=480, RIGHT_X=810, NODE_W=16
L_GAP=20, R_GAP=28, MID_H = AVAIL * 0.60

## Diagram JSON specification (v2)

This is the canonical data contract between the data processor and the visualizer.
All fields except `meta`, `nodes`, and `links` are optional.
The schema is fully backwards compatible — omitted optional fields use defaults.

```json
{
  "meta": {
    "title": "string — main diagram title",
    "subtitle": "string — secondary line below title (optional)",
    "subject": "string — e.g. player name, company name (optional)",
    "total": "number — grand total value",
    "unit": "string — e.g. 'goals', '$B', 'HC'",
    "source": "string — data attribution (optional)",
    "theme": "light | dark — defaults to light"
  },
  "columns": [
    {
      "id": "string — unique column identifier",
      "label": "string — column header label",
      "index": "number — left-to-right order starting at 0"
    }
  ],
  "nodes": [
    {
      "id": "string — unique node identifier",
      "column": "string — references a columns[].id",
      "label": "string — display name",
      "value": "number — total flow through this node",
      "color": "string — hex color (optional, auto-assigned if omitted)",
      "meta": "string — secondary annotation e.g. '+85% Y/Y' (optional)",
      "type": "neutral | aggregate | cost | loss — defaults to neutral"
    }
  ],
  "links": [
    {
      "from": "string — references a nodes[].id",
      "to": "string — references a nodes[].id",
      "value": "number — flow magnitude",
      "type": "neutral | profit | cost | loss — defaults to neutral"
    }
  ]
}
```

### Node types
- `neutral` — standard flow node (default, used in all current diagrams)
- `aggregate` — calculated node, result of combining upstream flows (e.g. Total Revenue, Gross Profit)
- `cost` — negative/expense node, renders with cost color (e.g. red tones)
- `loss` — flow that exits the system entirely (e.g. waste heat, tax leakage, writeoffs)

### Link types
- `neutral` — standard flow (default)
- `profit` — positive outcome flow, renders in node's color
- `cost` — expense flow, renders in cost color
- `loss` — flow exiting the system, renders as drain

### Validation rules
- Every `links[].from` and `links[].to` must reference a valid `nodes[].id`
- Every `nodes[].column` must reference a valid `columns[].id` (when columns are defined)
- `TOTAL` must equal sum of all right-side node values
- When penalties are broken out as a separate type (Jiménez pattern):
  `sum(TYPES.total)` will exceed `TOTAL` — this is expected and must be
  documented with a comment in the component file
- All `links` values for a given source node must sum to that node's `value`

## Edge cases

### Penalty overlap (Jiménez / Kane pattern)
Penalties are broken out as a separate TYPES entry for storytelling purposes
even though they are physically scored with a foot.
- TOTAL = sum of CLUBS.goals (net unique goals, not sum of TYPES)
- Penalty values in LINKS are NOT additive to right/left foot values
- Apply this pattern when a player scores 15+ career penalties or when
  penalties are a defining characteristic of their style

### When to use columns[]
Only needed for Tier 2+ diagrams (4+ columns, income statements, energy flows).
Soccer diagrams use the simplified 3-column layout hardcoded in the component.
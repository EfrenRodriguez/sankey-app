# Sankey App — Project Context

## What this is
A Next.js app deployed at sankey.efrenrodriguez.me that renders
interactive Sankey diagrams. Current focus: soccer player career
goal breakdowns for World Cup 2026 content.

## Tech stack
- Next.js 16 (App Router, no src/ dir)
- React with SVG-based custom Sankey renderer (no library)
- Tailwind CSS
- Vercel Analytics (`@vercel/analytics`)
- Deployed on Vercel, auto-deploy from GitHub main

## File structure
```
app/
  layout.js              → root layout: imports NavBar + Analytics
  page.js                → redirects / → /messi
  globals.css
  icon.js                → soccer ball emoji favicon (ImageResponse)
  components/
    NavBar.jsx           → client component — nav bar with active state
    MessiSankey.jsx      → Lionel Messi diagram
    CristianoRonaldoSankey.jsx
    ErlingHaalandSankey.jsx
    HarryKaneSankey.jsx
    KylianMbappeSankey.jsx
    RaulJimenezSankey.jsx
  messi/page.js          → renders MessiSankey
  ronaldo/page.js        → renders CristianoRonaldoSankey
  haaland/page.js        → renders ErlingHaalandSankey
  kane/page.js           → renders HarryKaneSankey
  mbappe/page.js         → renders KylianMbappeSankey
  jimenez/page.js        → renders RaulJimenezSankey
```

## Component naming convention
All Sankey component files follow the `NameLastNameSankey.jsx` pattern:
- `MessiSankey.jsx` (legacy — kept as-is)
- `CristianoRonaldoSankey.jsx`
- `ErlingHaalandSankey.jsx`
- `HarryKaneSankey.jsx`
- `KylianMbappeSankey.jsx`
- `RaulJimenezSankey.jsx`

New players must follow this convention exactly.

## Navigation (app/components/NavBar.jsx)
`NavBar.jsx` is a `"use client"` component — it uses `usePathname()`
to highlight the active player link.

To add a new player to the nav, update the `PLAYERS` array inside
`NavBar.jsx`:
```js
const PLAYERS = [
  { name: "Messi",   href: "/messi"   },
  { name: "Ronaldo", href: "/ronaldo" },
  // add new entry here
];
```

Nav style spec (do not change without approval):
- White background `#ffffff`, full-width, `#e2e8f0` bottom border
- Font: Inter 13px medium weight
- Active link: color `#1a202c` + `2px solid` underline
- Inactive links: color `#718096`
- `sankey.` bold logo on the left (font-size 15px, weight 800)
- Horizontal scroll on mobile, `flex-shrink: 0` on all items
- Scrollbar hidden, right-edge fade gradient as scroll hint

## Diagram architecture
Custom SVG Sankey with 3 columns: Goal Type → Total → Club/Country
- Left nodes: goal types (left foot, right foot, penalty, header, free kick)
- Mid node: single continuous stacked bar (proportional segments)
- Right nodes: clubs/countries spread vertically
- Flows: bezier ribbon paths (type color → club color)
- Hover highlight: isolates flows by type or club
- Tooltip: shows exact goals + % of career

## Visual style (DO NOT change without approval)
- White card on #f4f5f7 background
- Font: Inter (Google Fonts)
- Node width: 16px, rounded corners
- Flow opacity: 0.30 default, 0.65 highlighted, 0.04 dimmed
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

## Adding a new player — checklist
1. Create `app/components/NameLastNameSankey.jsx` using `MessiSankey.jsx`
   as the template — replace only TYPES, CLUBS, LINKS, TOTAL
2. Update the component name and SVG header text inside the file
3. Create `app/[slug]/page.js` that imports and renders the component
4. Add the player to the `PLAYERS` array in `app/components/NavBar.jsx`
5. Keep all layout constants identical (see below)
6. If using the penalty overlap pattern, add the explaining comment at
   the top of the DATA section in the component file

## Key layout constants (keep consistent across all players)
W=960, H=540, LEFT_X=155, MID_X=480, RIGHT_X=810, NODE_W=16
L_GAP=20, R_GAP=28, MID_H = AVAIL * 0.60

## Data edge cases

### Penalty overlap (Raúl Jiménez / Harry Kane pattern)
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
  sum(TYPES.total) will be > TOTAL when penalties are broken out.
  This is expected and intentional — document it in a comment
  inside the component file.

### When to break out penalties
Apply this pattern when a player scores 15+ penalties in their career
or when penalties represent a defining characteristic of their style
(e.g. Kane, Jiménez). Otherwise fold into right/left foot totals.

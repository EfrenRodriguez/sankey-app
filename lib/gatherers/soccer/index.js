// AGENT 1 — Soccer Data Gatherer
// Input: player id string (e.g. 'messi', 'ronaldo')
// Output: validated player data object matching sankey schema

import messi    from './players/messi.json'    assert { type: 'json' };
import ronaldo  from './players/ronaldo.json'  assert { type: 'json' };
import haaland  from './players/haaland.json'  assert { type: 'json' };
import mbappe   from './players/mbappe.json'   assert { type: 'json' };
import kane     from './players/kane.json'     assert { type: 'json' };
import jimenez  from './players/jimenez.json'  assert { type: 'json' };

const PLAYERS = { messi, ronaldo, haaland, mbappe, kane, jimenez };

export function getSoccerData(playerId) {
  const player = PLAYERS[playerId.toLowerCase()];
  if (!player) throw new Error(`Unknown player: ${playerId}. Available: ${Object.keys(PLAYERS).join(', ')}`);
  return player;
}

export function listPlayers() {
  return Object.keys(PLAYERS).map(id => ({
    id,
    name: PLAYERS[id].meta.subject,
    total: PLAYERS[id].meta.total,
  }));
}

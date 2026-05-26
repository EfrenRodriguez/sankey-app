/**
 * lib/gatherers/soccer/index.js
 *
 * Soccer data gatherer — returns a validated SankeyDiagram v2 object
 * for a given player slug.
 *
 * Usage:
 *   import { getSoccerData } from "@/lib/gatherers/soccer";
 *   const diagram = await getSoccerData("messi");
 */

/**
 * Map of player slugs to their data modules.
 * Add an entry here whenever a new player file is created under ./players/.
 */
const PLAYER_REGISTRY = {
  // "messi":   () => import("./players/messi.js"),
  // "ronaldo": () => import("./players/ronaldo.js"),
  // "haaland": () => import("./players/haaland.js"),
  // "mbappe":  () => import("./players/mbappe.js"),
  // "kane":    () => import("./players/kane.js"),
  // "jimenez": () => import("./players/jimenez.js"),
};

/**
 * Retrieve the SankeyDiagram v2 data object for a player.
 *
 * @param {string} slug - Player route slug (e.g. "messi", "ronaldo")
 * @returns {Promise<import("../../schema/sankey.schema.json")>}
 * @throws {Error} if the slug is not registered
 */
export async function getSoccerData(slug) {
  const loader = PLAYER_REGISTRY[slug];
  if (!loader) {
    throw new Error(
      `[soccer gatherer] Unknown player slug: "${slug}". ` +
      `Registered: ${Object.keys(PLAYER_REGISTRY).join(", ") || "(none yet)"}`
    );
  }
  const mod = await loader();
  return mod.default ?? mod;
}

/**
 * Return all registered player slugs.
 *
 * @returns {string[]}
 */
export function listSoccerPlayers() {
  return Object.keys(PLAYER_REGISTRY);
}

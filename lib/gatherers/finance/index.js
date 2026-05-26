/**
 * lib/gatherers/finance/index.js
 *
 * Finance data gatherer stub — will return a SankeyDiagram v2 object
 * representing financial flows (e.g. income → categories → savings/spend).
 *
 * Usage:
 *   import { getFinanceData } from "@/lib/gatherers/finance";
 *   const diagram = await getFinanceData(source);
 *
 * TODO: implement once finance data format is decided.
 *       Possible sources: CSV export, Plaid API, manual JSON.
 */

/**
 * @param {unknown} source - Data source (TBD — file path, API response, raw object)
 * @returns {Promise<import("../../schema/sankey.schema.json")>}
 */
export async function getFinanceData(source) { // eslint-disable-line no-unused-vars
  throw new Error(
    "[finance gatherer] Not yet implemented. " +
    "Define a data format and implement parsing here."
  );
}

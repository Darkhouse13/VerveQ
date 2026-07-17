import { describe, expect, it } from "vitest";

import { cpAssertFailures } from "../../../scripts/ingestWikidataPlayerData";
import { checkCommittedArtifacts } from "../../../scripts/buildDrawCardSet";

/**
 * E0.3 — THE DRAW data guards, wired into `npm run check` (via `npm run test`).
 *
 * Both were built in earlier tickets and both ran only when a human remembered to
 * type them, which is how the canonical file and the card set drifted apart in the
 * first place (E1 shipped corrections that lived in the card build while
 * playersSourced.json still carried the bugs, and nothing caught it — see
 * BUILD_NOTES §0a). A guard nobody runs is a guard that does not exist.
 *
 * Both are PURE and OFFLINE. They read the committed data files plus the
 * gitignored fetch cache; they never touch the network and never write. They are
 * imported rather than shelled out to, so they need no tsx dependency and no
 * subprocess — the scripts guard their own `main()` so importing them is inert.
 *
 * THE CACHE CAVEAT, stated plainly: `scripts/cache/careerPath/` is gitignored, so
 * on a machine that has never run the network stages these guards have nothing to
 * re-derive from and would fail for a reason that is not a defect. They skip in
 * that case, which means a fresh CI checkout does NOT currently exercise them.
 * Making that unconditional means committing the cache (~3.8 MB) or restoring it
 * in CI, and that is an owner decision rather than something to smuggle in here.
 */
import { existsSync } from "node:fs";
const CACHE_PRESENT =
  existsSync("../scripts/cache/careerPath/playerFacts.json") &&
  existsSync("../scripts/cache/careerPath/clubDict.json") &&
  existsSync("../scripts/cache/careerPath/sitelinks.json");

describe.skipIf(!CACHE_PRESENT)("draw data — the committed files reproduce from their rules", () => {
  /**
   * cp-assert. Re-runs the ingest emit in memory and diffs it against the
   * committed canonical file, then asserts the E0.2 spell invariant directly
   * against the fetch cache: one spell per surviving P54 statement, which a
   * min/max hull can never satisfy. Byte-equality alone would pass a re-merged
   * file happily, because the committed file would come back merged with it.
   */
  it("playersSourced.json is exactly what the ingest rules emit", () => {
    expect(cpAssertFailures()).toEqual([]);
  });

  /**
   * selector --check. Rebuilds both card artifacts from the canonical file plus
   * the sitelink backbone and the signed owner rulings, and asserts the committed
   * ones match. This is the guard E1/E1.1/E1.2 never had: the selector was not a
   * committed script at all, so a third party could not regenerate the set and
   * E1.2 could not even recover one era boundary to transcribe (BUILD_NOTES §11).
   */
  it("drawCardsReal.candidates.json + .dossier.json are exactly what the selector builds", () => {
    expect(checkCommittedArtifacts()).toEqual([]);
  });
});

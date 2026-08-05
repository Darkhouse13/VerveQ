# FW-LAUNCH blind verification — O1 budget mode — 2026-08-01

## VERDICT: PASS

The current implementation conforms to BUDGET_MODE_SPEC v1.3.0 in both directions for the named scope. The required pure-layer probes, live DEV walkthrough, independent row inspection, idempotent purge, and pre/post checks passed.

## Conformance

| Spec rule | Implementation evidence | Result |
|---|---|---|
| 13 = XI + 2 finishers | Constants are 13/11/2 (`app/convex/lib/fantasyConstants.ts:24-30`); shape checks size, indices, and finisher count (`app/convex/lib/fantasySquadRules.ts:80-115`); creation materializes XI then two finishers (`app/convex/fantasySquads.ts:304-335`). | ✓ |
| XI formation: GK 1, DEF 3–5, MID 2–5, ATT 1–3, total 11 | Bounds are centralized (`fantasyConstants.ts:49-54`); every line and total are checked (`fantasySquadRules.ts:152-176`); create and every post-edit path invoke these validators (`fantasySquads.ts:276-277`, `fantasySquadRules.ts:337-346`). | ✓ |
| Finisher roles are free and excluded from XI shape | `formationOf` skips finishers (`fantasySquadRules.ts:136-141`); creation accepts exactly two independently selected roles (`fantasySquads.ts:272-275,318-329`). | ✓ |
| Duplicate player prohibited (`duplicate_player`) | Filled IDs are uniqued and violation code is exactly `duplicate_player` (`fantasySquadRules.ts:117-126`); post-edit validation runs before patch (`fantasySquads.ts:418-433`). | ✓ |
| Non-favorite club cap 3; favorite exempt; build-time snapshot | Cap and exemption are implemented at `fantasySquadRules.ts:201-229`; favorite is resolved once and stored on creation (`fantasySquads.ts:289-302`), then that snapshot is passed to every post-edit check (`fantasySquads.ts:170-178`). | ✓ |
| Favorite changes use a 28-day timestamp; old favorite remains; first set immediate | 28-day millisecond constant (`fantasyConstants.ts:106-107`); pending changes settle only at `now >= effectiveFrom` (`fantasyFavoriteClub.ts:75-87`); first set is immediate and later change preserves old club while queuing new club for `now + cooldown` (`fantasyFavoriteClub.ts:132-159`). | ✓ |
| Budget 91.0; committed + live invariant during partial locks | Constant is 91.0 (`fantasyConstants.ts:125`); null slots are skipped, locked slots use committed/current price, unlocked slots use live price, and total is compared to limit (`fantasySquadRules.ts:265-317`); live lock map is supplied on edits (`fantasySquads.ts:166-179`). | ✓ |
| Per-fixture lock: no swap-out and no kicked-off swap-in | Target lock is checked before edit (`fantasySquads.ts:399-403`); selected player's fixture must exist and kickoff must not have passed (`fantasySquads.ts:405-415`); whole-squad formation rejects any changed locked slot (`fantasySquads.ts:497-509`); kickoff boundary is `now >= kickoffAt` (`fantasyLocks.ts:95-97`). | ✓ |
| Unpriced player rejected fail-closed | `validateBudget` returns `unpriced_player` before summing (`fantasySquadRules.ts:284-294`); budget context always invokes it (`fantasySquadRules.ts:346`). | ✓ |
| Player must be active and have target-GW fixture | `setSlotFor` rejects inactive players and missing fixtures server-side (`fantasySquads.ts:408-415`); market UI also badges/disables fixtureless players (`app/src/pages/shell/weekend/BudgetSquadScreen.tsx:511-531`). | ✓ |
| Unfilled slot legal and costless; scores exactly zero contribution and is counted empty | Null player is skipped by budget (`fantasySquadRules.ts:275`), and empty slots remain unlocked (`fantasyLocks.ts:109-112`). `squadScore` increments `emptySlots`, emits the empty row, and continues before its only total increment (`fantasyScores.ts:1599-1603,1661-1664`), so contribution is exactly zero. UI states “Empty — scores 0” (`BudgetSquadScreen.tsx:303-305`). | ✓ |
| Fresh squad weekly | Uniqueness key is user + gameweek + constant context key `budget` (`fantasySquads.ts:279-288`), so each GW has an independent squad while duplicate same-GW creation is rejected. | ✓ |
| Public calls cannot create crew squads | Public wrapper invokes `assertPublicSquadCreateArgs` before creation (`fantasySquads.ts:226-230`); the guard unconditionally rejects `context: "crew"` (`fantasySquads.ts:238-246`). | ✓ |

### Code → spec check

No rule-shaped behavior in the named implementation lacked support in BUDGET_MODE_SPEC v1.3.0. Authentication/ownership checks are access control rather than fantasy game rules. The UI's server-authoritative presentation and error surfacing do not alter legality.

## Adversarial results

1. **Exactly 91.0 / 91.5:** structurally enforced by `validateBudget` (`fantasySquadRules.ts:265-317`). Live boundary world accepted 13 × 7.0 and rejected 91.5 with: `Squad costs 91.5 of a 91.0 budget (0.0 already committed to locked slots).` Sim assertions are at `fantasyBudgetSim.ts:536-557`.
2. **Fourth same-club player:** structurally prevented unless `clubId === favoriteClub` (`fantasySquadRules.ts:201-229`). Live sim accepted four favorite-club players and rejected the fourth non-favorite player (`fantasyBudgetSim.ts:593-612`).
3. **Locked slot through whole-squad `setFormation`:** structurally prevented by comparing every locked slot's role/finisher state before any patch (`fantasySquads.ts:497-509`). Live refusal matched `SLOT_LOCKED` (`fantasyBudgetSim.ts:629-647`).
4. **Kicked-off player swapped into an unlocked slot:** structurally prevented by the selected player's own fixture check (`fantasySquads.ts:405-415`). Live refusal: `That player's match has already kicked off; he can no longer be selected.`
5. **Public `context: "crew"`:** structurally prevented before the create core (`fantasySquads.ts:226-246`). Live refusal matched `CREW_SQUAD_DRAFT_ONLY` (`fantasyBudgetSim.ts:665-671`).
6. **Pure 91.5 recomputation:** `validateBudget` returned `ok:false`, breakdown `{committed:0, live:91.5, total:91.5, limit:91}`, and a message containing both 91.5 and 91.0.
7. **Pure club-cap recomputation:** the same four-A snapshot failed with no favorite (`club_cap`) and passed with favorite `A`.
8. **Pure favorite recomputation:** first set produced immediate `{favoriteClub:"A"}`; A→B produced old in-force A, pending B, effective timestamp `now + 2,419,200,000`; A remained at day 27 and B became active at day 28.

Hand recomputations performed: 3 groups (budget boundary, cap both directions, favorite first/change boundaries).

## Live DEV transcript

Deployment contacted: **admired-warthog-495 only**. No external API was called.

### Pre-check

```text
cd app && npm run check
132 test files passed; 1356 tests passed; TypeScript/lint/build completed.
Lint: 0 errors, 2 warnings. Build completed.
```

The initial accidental invocation from repository root failed with ENOENT because the package is under `app/`; it contacted no deployment. The required invocation from `app/` then passed.

### Walkthrough

```text
cd app && npx convex run fantasyBudgetSim:simulateBudgetBuild '{"salt":"verify"}'
```

Key output:

```json
{
  "verdict": "PASS — purge with fantasyBudgetSim:purgeSimBudgetData",
  "created": "tx7dwstgytftmpr0xx5g6f5hp98bmejt",
  "exactBudgetAccepted": "13 players at 91.0 = SQUAD_BUDGET exactly, all accepted",
  "halfStepOverRejected": "Squad costs 91.5 of a 91.0 budget (0.0 already committed to locked slots).",
  "favoriteFourthAccepted": "4 × SYNTH-O1F accepted with the favorite set (cap 3)",
  "nonFavoriteFourthRejected": "At most 3 players from one club (SYNTH-O1A has 4). Your favorite club is exempt.",
  "lockedSetFormationRejected": "That player's match has kicked off — his slot is locked for this gameweek.",
  "kickedOffSwapInRejected": "That player's match has already kicked off; he can no longer be selected.",
  "crewCreateRejected": "Crew squads are created by the draft, not by hand — finish the draft and your sheet appears.",
  "boundaryWorld": "built, probed and deleted in-transaction (52 rows)"
}
```

The live-market `overBudgetRejected` message also contained a club-cap violation; this does not undermine the isolated transaction-local 91.5 boundary probe above, which carried only the budget violation. The deployment had no active fixture-bearing unpriced player, so the sim reported its optional unpriced live probe as skipped; the fail-closed code path and pure test were independently verified.

### Independent kept-row inspection before purge

Direct `npx convex data ... --deployment admired-warthog-495` table reads found:

- sim users: **1** (`simbudget_verify`)
- matching squads: **1** (`tx7dwstgytftmpr0xx5g6f5hp98bmejt`)
- matching slots: **13**

The slots had indices 0–12 exactly once, 11 XI plus two finishers, all 13 filled. The arranged state was visible: slot 10 was a MID finisher and slot 11 an ATT starter.

### Purge and verification

```text
PURGE 1:
{ "deletedSlots": 13, "deletedSquads": 1, "deletedUsers": 1 }
PURGE 2:
{ "deletedSlots": 0, "deletedSquads": 0, "deletedUsers": 0 }
```

Direct post-purge table inspection found **0 users, 0 squads, 0 slots** for the kept IDs/tag (the squad and slot tables were wholly empty at inspection time). Before → after: users **1→0**, squads **1→0**, slots **13→0**.

### Post-check

```text
cd app && npm run check
132 test files passed; 1356 tests passed; TypeScript/lint/build completed.
Lint: 0 errors, 2 warnings. Build completed.
```

## Findings

None.

## Scope disclosures and limits

- Read the explicitly named test inputs despite the general test-file prohibition: `app/src/test/fantasySquadRules.test.ts`, `app/src/test/fantasyLockEngine.test.ts`, and `app/src/test/fantasyBudgetSquadUi.test.tsx` (O1 conformance evidence).
- Read only the explicitly authorized `squadScore` region of `app/convex/fantasyScores.ts` (lines 1546–1713), plus grep context needed to locate that region. No other region was used as evidence.
- `research/fantasy/BLIND_VERIFY_PACKAGE.md` was read because the assignment explicitly required it.
- No repository file outside O1's named inputs was directly opened or grepped. `npm run check` necessarily executed the project-wide toolchain; its test runner printed an expected synthetic error stack naming `app/src/test/errorMonitoringContract.test.tsx`, but that file was not opened or inspected.
- `npx convex data --help` was run solely to establish the safe DEV table-inspection syntax. Direct data inspection explicitly pinned `admired-warthog-495`; no PROD command or external API call was made.

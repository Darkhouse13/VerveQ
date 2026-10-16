# RETURN LOOP — share, follow, keep your streak

Spec, 2026-10-16. Scope: the result screen of the two daily games, Missing
Letters (`app/src/pages/shell/play/MissingLettersPlayScreen.tsx`) and Who's
Older (`WhosOlderPlayScreen.tsx`), plus their shared retention pieces
(`app/src/components/shell/play/whosOlder/WhosOlderRetention.tsx`,
`app/convex/lib/dailyGames.ts`).

## Why

PostHog, Oct 9 12:00 to Oct 16 17:40 UTC (test events excluded):

- **Nobody comes back.** 7-day return for players who first played Sep 26 to
  Oct 9 is 17 of 234 (7%). For players whose first game was inside
  Instagram's in-app browser it is 6 of 124 (5%); phone browsers 9 of 74 (12%).
- **Email reminders don't work for this audience.** The reminder card was shown
  182 times across both games; sign-ups are 0 (prod `whosOlderReminders` is
  empty).
- **Sharing exists but nobody uses it.** Both games already have a share
  button that mints a challenge link and sends an emoji row. It fired 7 times
  this week against about 138 finished dailies (≈5%).
- **Most players are on Instagram.** 84% of bio-link sessions (202 of 241)
  open in Instagram's in-app browser; 100 of this week's 214 players played
  there.
- **The streak stays in one browser.** It is computed server-side per
  anonymous account (`whosOlder.ts:182`), and the account lives in that
  browser's storage. The only thing that joins two browsers is opening a
  reminder email (`streakUserIds`, `dailyGames.ts:53`), which nobody has done.
  Claiming a username does not help: it attaches no login, so it can't be used
  in another browser until an email and password are added.

The return path that already works is Instagram itself: followers went 277 →
450 in three days. A player who comes back through Instagram lands in the same
in-app browser and keeps their streak.

## Status

All three parts built 2026-10-16, uncommitted and not on prod. Part C's tables
and functions are pushed to DEV only.

- A + B: `app/src/lib/dailyShare.ts`,
  `app/src/components/shell/play/whosOlder/DailyShare.tsx`, both play
  screens, `ReminderCard collapsed`.
- C: `convex/dailyStreakLinks.ts`, tables `dailyStreakLinks` +
  `dailyStreakTransfers`, rules in `convex/lib/whosOlderRetention.ts`,
  `streakUserIds` + `findPlayerDaily` in both games,
  `app/src/hooks/useStreakLinkClaim.ts`, `StreakLinkOffer`.
- Tests: `src/test/dailyShare.test.ts`, `src/test/dailyStreakLinks.test.ts`;
  e2e `missingLetters.spec.ts` (incl. "streak link carries the streak to
  another browser") and `whosOlderRetention.spec.ts`, all passing on DEV.
- Still to do: the A3 phone spike (Instagram in-app browser, iPhone +
  Android), and the same phones copying a streak link out of Instagram.

## What changes

Three parts, shipped in this order. A and B are frontend-only. C needs a
Convex schema change and a manual prod deploy.

### A. Share first

The share is the reminder and the advert at once: every result posted to a
group chat or story brings the poster back tomorrow to defend it, and brings
new people in.

**A1. Reorder the finished daily screen** (both games, not challenge runs):

1. Score card (unchanged: edition, score, emoji row, standing).
2. **One full-width primary button: "Share result"** (pink, `size="lg"`). It
   keeps today's behaviour: mint the challenge link, then share text and link.
3. Streak block.
4. "Endless" becomes a secondary full-width button (outline/ghost variant)
   below the streak, with the best-streak line under it.
5. Follow card (part B), then the collapsed email reminder, then challenge
   results, then the answers list.

Today Share and Endless sit side by side at equal weight, and Endless is the
most-played thing in the app (312 runs from 29 people this week), so it wins
the tap. **Decided 2026-10-16:** demote Endless.

**A2. A richer share text.** Group the emoji row by difficulty tier so it reads
as a story, add the standing when it shows on screen, and drop "Beat me 👇" in
favour of the link doing the talking:

```
Missing Letters #6 · 7/10
🟩🟩🟩 🟩🟥🟩 🟥🟩🟥 🟩
Better than 82% of today's players
verveq.com/letters?c=…
```

- The tier groups come from `Reveal.tier` (EASY×3 / MEDIUM×3 / HARD×3 /
  IMPOSSIBLE for Missing Letters). Who's Older has no tiers: groups of 5.
- The standing line appears only when `standing.finishers >=
  MIN_FINISHERS_FOR_STANDING`, as on screen.
- New i18n keys `missingLetters.shareText` / `whosOlder.shareText` (en, fr,
  es); keep `challengeText` for the challenge banner flow until it's unused.

**A3. A story image.** Instagram stories are where this audience shares, and a
text share can't go there.

- Render a 1080×1920 PNG on a `<canvas>` in the game's own palette: edition,
  score, the tier-grouped grid as squares, the standing, and
  `verveq.com/letters` at the bottom. Keep everything inside the content safe
  zone (top 220 / bottom 320 / sides 60 px, same as the reels).
- Delivery, tried in order:
  1. `navigator.canShare({ files: [png] })` true → `navigator.share({ files,
     text, url })`.
  2. Otherwise open a sheet showing the image as an `<img src="data:…">` with
     "Press and hold the image to save it, then add it to your story". Press
     and hold to save works in in-app web views where downloads don't.
- **Spike first (half a day):** on a real iPhone and Android phone, inside the
  Instagram in-app browser, check (a) whether `navigator.share` with files
  works, (b) whether press and hold saves the image. The answers decide which
  path is the default. Record them in this file.

The "Share result" button opens a small sheet with two choices: "Send to a
friend" (A2, the native share or clipboard) and "Post to your story" (A3).

### B. Follow for tomorrow

Replace the email form as the main "come back" card for Instagram visitors.

- Show when the user agent contains `Instagram`, or the referrer is
  instagram.com (`isInstagramVisitor`, `app/src/lib/dailyShare.ts`). Everyone else keeps the reminder card in its current spot.
- Card copy: **"New puzzle every morning on @playverveq"** with a button
  "Follow @playverveq" linking to `https://www.instagram.com/playverveq/`.
- The copy must stay true to what we post. The reels are their own editions,
  not the app's daily, so don't promise "#7 drops at 08:30" unless the posting
  plan changes to match (see owner decision 3).
- Check on both phones that the link opens the profile (natively or in the web
  view) with a working Follow button. If it doesn't, fall back to copy that
  names the handle without a link.
- The email reminder stays available for everyone but collapses to one line,
  "Or get an email reminder", that expands the existing form. It has had no
  sign-ups, so this loses nothing. **Decided 2026-10-16:** collapse to one line.

### C. Take your streak to another browser

For the player who builds a streak inside Instagram and later opens VerveQ in
Safari or Chrome.

**Client.** Under the streak block, only in Instagram's in-app browser (user
agent), show: "Playing in Safari or Chrome next time? Take your N-day streak
with you" and "Copy link". It shows from a **1-day** streak, not 2 as first
drafted: the first return is where players are lost, so day 1 is the moment to
offer it. "Copy link" mints a token and copies
`verveq.com/letters?st=<token>&ref=streak_link` (or `/older`). The clipboard is
handed a promise, so the copy keeps the tap's permission while the link is
minted; if the copy is refused, the link is shown in a field to copy by hand.

Opening the link: the play screen claims `?st=` first, strips it from the
address bar, toasts "Streak connected", and only then deals today's daily.
The email reminder link (`?rt=`) now waits the same way.

**Same-day behaviour.** If a linked browser already finished today's daily,
the new browser opens on that result (`findPlayerDaily`) instead of dealing the
same ten boards again. Endless is unlocked from it, and "Share result" can mint
a challenge from it.

**Server** (new file `convex/dailyStreakLinks.ts`, rules in
`convex/lib/dailyGames.ts`):

```ts
// One group per person: every browser (anonymous account) in it shares a streak.
dailyStreakLinks: defineTable({
  groupId: v.string(),          // the first account's id, as a string
  userId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_group", ["groupId"]),

dailyStreakTransfers: defineTable({
  token: v.string(),            // 128-bit random, base64url
  fromUserId: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.number(),        // createdAt + 7 days
  claimCount: v.number(),
})
  .index("by_token", ["token"])
  .index("by_from_created", ["fromUserId", "createdAt"]),
```

- `createTransfer()`: rate-limited to 5 a day per account.
- `claimTransfer({ token })`: rejects expired tokens and claims by the
  issuing account. Puts both accounts in one group: reuse the sender's group if
  it has one, else create one keyed by the sender's id; if the claimer already
  belongs to another group, move the claimer's whole group in. Cap a group at 5
  accounts and a token at 3 claims.
- `streakUserIds(ctx, game, userId)` returns the union of today's
  reminder-link accounts and the streak-link group, capped at 20 as now. The
  link covers both games: it's per person, not per game.
- Merging is safe because the streak is computed from finished daily dates
  (`finishedDailyDates`), so two accounts' days union naturally.

Deploy: prod Convex is a manual deploy. Diff `convex/` against the last
known-good SHA before deploying, then push the frontend.

## Analytics

Add to `docs/ANALYTICS.md` (prefix `missing_letters_` / `whos_older_`):

| Event | When | Properties |
|---|---|---|
| `*_share_pressed` | "Share result" is pressed | `edition`, `score` |
| `*_share_sent` | the native share resolves, the clipboard write succeeds, or the image sheet opens | `method` (`native` \| `clipboard` \| `image_native` \| `image_sheet`) |
| `*_follow_shown` | the follow card first renders | — |
| `*_follow_clicked` | the follow button is pressed | — |
| `daily_streak_link_created` | a transfer token is minted | `game`, `streak` |
| `daily_streak_link_claimed` | a claim succeeds | `game`, `merged_accounts` |

The existing `*_challenge_shared` keeps firing as is so the baseline stays
comparable.

## How we'll know (two weeks after A+B ship)

| Measure | Baseline (Oct 9–16) | Target |
|---|---|---|
| Shares per finished daily | ≈5% (7 of ~138) | 15% |
| Sessions arriving from share links (`ref=*_share` / `*_challenge`) | measure at ship | rising week on week |
| Follow clicks per follow card shown | — | 10% |
| 7-day return, first game in Instagram's browser | 5% (6 of 124) | 10% |
| 7-day return, all new players | 7% (17 of 234) | 10% |

The return figures undercount anyone who switches browser (they show up as a
new person); part C also fixes that for the people it reaches.

## Owner decisions

1. **Demote Endless** below Share: yes (2026-10-16).
2. **Email reminder:** collapse to one line (2026-10-16).
3. **Daily story with a link sticker** — checked 2026-10-16:
   - Our Postiz (v2.10.1) can post Instagram stories: its Instagram provider
     sends `media_type=STORIES` when a post's settings carry
     `post_type: "story"` (one image or one video). `tools/social/publish.mjs`
     always sends `post_type: "post"` today.
   - Nothing can add the **link sticker**: Meta's publishing API has no sticker
     fields, and Postiz sends none. The only tools claiming it use unofficial
     automation, which risks the account.
   - So: automate a daily story image ("Missing Letters #7 is live — link in
     bio"), with the bio pointing at today's puzzle; adding a real link sticker
     stays a manual 1-minute tap in the app. Story publishing on our account is
     untested; post one test story before scheduling it.

## Out of scope here

Group leagues for the daily game (a shared weekly table for a group chat), and
featuring top players in reels. Both come after this, once shares and return
are moving.

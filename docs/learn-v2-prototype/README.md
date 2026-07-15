# Learn v2 — prototype reference (design source of truth)

These files are the standalone React prototype (from `verveq.zip`) that the
production Learn v2 build is ported from. **Reference only** — not compiled, not
imported by the app.

| Prototype file | Ported to |
|---|---|
| `learn.jsx` | `app/src/components/learn/QuestionTypes.tsx`, `TeachingReveal.tsx`; `app/src/pages/shell/learn/LearnEntryScreen.tsx`, `LearnRunnerScreen.tsx` |
| `learn-meta.jsx` | `app/src/pages/shell/learn/LearnReviewScreen.tsx`, `LearnMasteryScreen.tsx` |
| `data.jsx` | `app/src/lib/learn/fixtures.ts` (answer-free shapes) |
| `ui.jsx` | `app/src/components/learn/LearnPrimitives.tsx` |
| `theme.css` | `.theme-learn` WARM palette in `app/src/index.css` (shell scaffold) |

## The one deliberate divergence: server-authoritative grading

The prototype grades **client-side** (`isCorrect()` in `learn.jsx`, with the
answer key inlined in `data.jsx`). The production build inverts this: the
frontend NEVER grades. It submits `{ sessionId, questionId, answer }` through a
single seam (`app/src/lib/learn/useLearnGrading.ts`) and renders the server's
`LearnVerdict`. See `app/src/lib/learn/contract.ts`.

All four question types (mcq / text / numeric / order) route through the single
server-authoritative mutation `api.learn.submitLearnRung`
(`app/src/lib/learn/useLearnGrading.ts:8-13`); the graders live at
`app/convex/learnGraders.ts`. There is no client-side correctness logic anywhere
in the Learn UI.

> NOTE 2026-07-15: this previously described text / numeric / order as routing
> through a quarantined client stub (`stubGrader.ts`) pending graders on
> `feat/v2-learn-graders`, with the swap to the real mutation "a one-line change".
> That swap has happened — `stubGrader.ts` no longer exists (zero references
> repo-wide) and the graders shipped.

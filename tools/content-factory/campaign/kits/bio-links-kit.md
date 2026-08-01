# Owner kit — channel bio links (the UTM floor)

**Owner time: ~10 minutes, one-time.** Needed by: week 0, before the
first video posts. This closes the untagged-link funnel hole — after
this, every click from any channel attributes cleanly in the waitlist
join records (the teaser already ingests `utm_source`).

Paste each URL into that channel's bio/profile link field:

| Channel | Where | URL |
|---|---|---|
| TikTok | Profile → Edit profile → Website | `https://verveq.com/?utm_source=tiktok&utm_medium=social&utm_campaign=weekend26&utm_content=bio` |
| Instagram | Profile → Edit profile → Links | `https://verveq.com/?utm_source=instagram&utm_medium=social&utm_campaign=weekend26&utm_content=bio` |
| YouTube | Channel → Customization → Links | `https://verveq.com/?utm_source=youtube&utm_medium=social&utm_campaign=weekend26&utm_content=bio` |
| X | Profile → Edit profile → Website | `https://verveq.com/?utm_source=x&utm_medium=social&utm_campaign=weekend26&utm_content=bio` |

Notes:
- These are the *bio* links (`utm_content=bio`). Per-asset links (story
  stickers, YT descriptions, X posts) ship inside each asset's caption
  `.txt` with `utm_content=<asset-slug>` — paste those per post, they're
  already tagged.
- On-screen end-cards always say clean `verveq.com` — nobody types a
  query string; only clickable links carry tags.
- If a channel offers multiple link slots, the tagged one goes first.

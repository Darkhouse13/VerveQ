/**
 * Programmatic pages built from the sourced player facts:
 *  - /who-played-for/<club>-and-<club>/      (football grid club × club answers)
 *  - /who-played-for/<club>-and-<country>/   (club × nationality answers)
 *  - /who-played-for/<club>/                 (club hub linking its pairs)
 *  - /career-path-quiz/<set>/                (10 career paths, answers hidden)
 *
 * Every list is framed as "in VerveQ's database": the pages are honest about
 * being a curated set, not an exhaustive register of every player ever.
 */
import { breadcrumbLd, cta, esc, faqLd, faqSection, linkGrid, listJoin, slugify, ORIGIN } from "../lib.mjs";
import { loadPlayers } from "../data.mjs";

const HOME = { name: "VerveQ", path: "/" };
const WPF = { name: "Who played for", path: "/who-played-for/" };
const CPQ = { name: "Career path quiz", path: "/career-path-quiz/" };

export const PAIR_MIN = 6;
export const NATION_MIN = 5;
const CLUB_HUB_MIN = 25;

/**
 * Moves straight from one club to the other: a spell at the second club starts
 * within a year of a spell at the first ending, with no OTHER club's spell
 * starting in between (a loan inside the first spell doesn't break it).
 */
function directMove(p, a, b) {
  const spellsOf = (slug) => (p.clubs.find((c) => c.slug === slug)?.spells ?? []).filter((s) => s.start);
  const others = p.clubs.filter((c) => c.slug !== a && c.slug !== b).flatMap((c) => c.spells.filter((s) => s.start));
  const moves = [];
  for (const [from, to] of [[a, b], [b, a]]) {
    for (const sf of spellsOf(from)) {
      if (!sf.end) continue;
      for (const st of spellsOf(to)) {
        const gap = st.start - sf.end;
        if (gap < 0 || gap > 1) continue;
        const interrupted = others.some((o) => o.start > sf.end && o.start < st.start);
        if (!interrupted) moves.push({ from, year: st.start });
      }
    }
  }
  const unique = new Map(moves.map((m) => [`${m.from}|${m.year}`, m]));
  return [...unique.values()].sort((x, y) => x.year - y.year);
}

/** "a" / "an" before a club or nation name. */
function article(word) {
  return /^[AEIOUaeiou]/.test(word) ? "an" : "a";
}

/** Latest spell start at the given clubs — breaks "present" ties by who arrived last. */
function latestStart(p, slugs) {
  return Math.max(0, ...p.clubs.filter((c) => slugs.includes(c.slug)).flatMap((c) => c.spells.map((s) => s.start ?? 0)));
}

function byRecency(a, b) {
  return b.sortYear - a.sortYear || b.tie - a.tie || a.name.localeCompare(b.name);
}

function titleFit(...candidates) {
  return candidates.find((t) => t.length <= 60) ?? candidates[candidates.length - 1];
}

export function buildPlayerPages({ quizQuestions = [] } = {}) {
  const { players, careerPaths } = loadPlayers();
  const clubMeta = new Map(); // slug -> {name, count}
  for (const p of players) for (const c of p.clubs) {
    const m = clubMeta.get(c.slug) ?? { name: c.name, slug: c.slug, players: [] };
    m.players.push(p);
    clubMeta.set(c.slug, m);
  }

  // ── Club × club ─────────────────────────────────────────────────────────
  const pairs = new Map();
  for (const p of players) {
    const slugs = p.clubs.map((c) => c.slug).sort();
    for (let i = 0; i < slugs.length; i++) for (let j = i + 1; j < slugs.length; j++) {
      const key = `${slugs[i]}|${slugs[j]}`;
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push(p);
    }
  }
  const pairPages = [];
  for (const [key, list] of pairs) {
    if (list.length < PAIR_MIN) continue;
    const [sa, sb] = key.split("|");
    const A = clubMeta.get(sa);
    const B = clubMeta.get(sb);
    const path = `/who-played-for/${sa}-and-${sb}/`;
    const rows = list
      .map((p) => {
        const ca = p.clubs.find((c) => c.slug === sa);
        const cb = p.clubs.find((c) => c.slug === sb);
        return { p, ca, cb, sortYear: Math.max(ca.lastYear, cb.lastYear), tie: latestStart(p, [sa, sb]), name: p.name, moves: directMove(p, sa, sb) };
      })
      .sort(byRecency);
    const direct = rows.filter((r) => r.moves.length);
    const nations = new Map();
    for (const r of rows) if (r.p.nation) nations.set(r.p.nation, (nations.get(r.p.nation) ?? 0) + 1);
    const topNation = [...nations.entries()].sort((x, y) => y[1] - x[1])[0];
    const mostRecent = rows[0];
    const earliest = [...rows].sort((x, y) => Math.min(x.ca.firstYear, x.cb.firstYear) - Math.min(y.ca.firstYear, y.cb.firstYear))[0];
    const n = rows.length;
    const faqs = [
      { q: `How many players have played for both ${A.name} and ${B.name}?`, a: `VerveQ's database of fact-checked careers has ${n} players who played for both ${A.name} and ${B.name}, including ${listJoin(rows.slice(0, 3).map((r) => r.p.name))}.` },
      { q: `Who is the most recent player to play for ${A.name} and ${B.name}?`, a: `${mostRecent.p.name}: ${A.name} ${mostRecent.ca.spellText || "(years unknown)"}, ${B.name} ${mostRecent.cb.spellText || "(years unknown)"}.` },
      ...(direct.length
        ? [{ q: `Which players moved directly between ${A.name} and ${B.name}?`, a: `${listJoin(direct.slice(0, 6).map((r) => r.p.name))}${direct.length > 6 ? ` and ${direct.length - 6} more` : ""} moved straight from one club to the other.` }]
        : []),
      { q: `Who can I use for ${A.name} × ${B.name} in a football grid?`, a: `Any player on this list fits ${article(A.name)} ${A.name} × ${B.name} cell. Well-known answers are ${listJoin(rows.slice(0, 2).map((r) => r.p.name))}; for a rarer pick try ${rows[rows.length - 1].p.name}.` },
    ];
    const crumbs = [HOME, WPF, { name: `${A.name} and ${B.name}`, path }];
    const table = `<div class="seo-scroll"><table><thead><tr><th>Player</th><th>${esc(A.name)}</th><th>${esc(B.name)}</th><th>Nation · position</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td><strong>${esc(r.p.name)}</strong></td><td>${esc(r.ca.spellText || "—")}</td><td>${esc(r.cb.spellText || "—")}</td><td>${esc([r.p.nation, r.p.position].filter(Boolean).join(" · ") || "—")}</td></tr>`)
      .join("")}</tbody></table></div>`;
    pairPages.push({
      key,
      clubs: [sa, sb],
      count: n,
      linkLabel: `${A.name} and ${B.name}`,
      note: `${n} players`,
      path,
      page: {
        path,
        title: titleFit(
          `Who Played for ${A.name} and ${B.name}? ${n} Players | VerveQ`,
          `Who Played for ${A.name} and ${B.name}? ${n} Players`,
          `Who Played for ${A.name} and ${B.name}?`,
          `${A.name} & ${B.name}: ${n} Players Who Played for Both`,
          `${A.name} & ${B.name}: Players Who Played for Both`,
          `${A.name} & ${B.name} Players`,
        ),
        description: `${n} players who played for both ${A.name} and ${B.name}, with the years at each club, including ${listJoin(rows.slice(0, 3).map((r) => r.p.name))}. Football grid answers.`.slice(0, 155),
        breadcrumbs: crumbs,
        ogType: "article",
        jsonLd: [
          breadcrumbLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Players who played for ${A.name} and ${B.name}`,
            numberOfItems: n,
            itemListElement: rows.map((r, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Person", name: r.p.name, ...(r.p.qid ? { sameAs: `https://www.wikidata.org/wiki/${r.p.qid}` } : {}) } })),
          },
          faqLd(faqs),
        ],
        body: `<div class="seo-hero"><span class="seo-tag">Football grid answers</span>
<h1>Who played for ${esc(A.name)} and ${esc(B.name)}?</h1>
<p class="seo-lede"><strong>${n} players</strong> in VerveQ's fact-checked player database played for both ${esc(A.name)} and ${esc(B.name)}. The most recent is <strong>${esc(mostRecent.p.name)}</strong>; the earliest is ${esc(earliest.p.name)}.${topNation && topNation[1] > 1 ? ` The most common nationality among them is ${esc(topNation[0])} (${topNation[1]}).` : ""}</p>
${cta("/v2/verve-grid?ref=seo_wpf", "Play the football grid")}</div>
<h2>All ${n} players who played for both clubs</h2>
<p>Years are each player's spells at the club (loans included), sourced from Wikidata. Most recent first.</p>
${table}
${direct.length ? `<h2>Players who moved directly between ${esc(A.name)} and ${esc(B.name)}</h2><ul>${direct
          .map((r) => `<li><strong>${esc(r.p.name)}</strong>: ${r.moves.map((m) => `${m.from === sa ? `${esc(A.name)} → ${esc(B.name)}` : `${esc(B.name)} → ${esc(A.name)}`} (${m.year})`).join(", ")}</li>`)
          .join("")}</ul>` : ""}
<h2>Using this in a football grid</h2>
<p>In a football grid or tic-tac-toe puzzle, any player above fills ${article(A.name)} ${esc(A.name)} × ${esc(B.name)} cell. Famous names are the safe choice; rarer names like ${esc(rows[rows.length - 1].p.name)} are what separate a good grid from a great one.</p>
${faqSection(faqs)}
<div id="seo-related"></div>`,
      },
    });
  }

  // ── Club × nation ───────────────────────────────────────────────────────
  const nationPages = [];
  for (const [slug, club] of clubMeta) {
    const byNation = new Map();
    for (const p of club.players) {
      if (!p.nation || !p.nationAdj) continue;
      if (!byNation.has(p.nation)) byNation.set(p.nation, []);
      byNation.get(p.nation).push(p);
    }
    for (const [nation, list] of byNation) {
      if (list.length < NATION_MIN) continue;
      const adj = list[0].nationAdj;
      const nslug = slugify(nation);
      const path = `/who-played-for/${slug}-and-${nslug}/`;
      const rows = list
        .map((p) => {
          const c = p.clubs.find((x) => x.slug === slug);
          return { p, c, sortYear: c.lastYear, tie: latestStart(p, [slug]), name: p.name };
        })
        .sort(byRecency);
      const n = rows.length;
      const crumbs = [HOME, WPF, { name: `${adj} players at ${club.name}`, path }];
      const faqs = [
        { q: `How many ${adj} players have played for ${club.name}?`, a: `VerveQ's database of fact-checked careers has ${n} ${adj} players who played for ${club.name}, including ${listJoin(rows.slice(0, 3).map((r) => r.p.name))}.` },
        { q: `Who is the most recent ${adj} player at ${club.name}?`, a: `${rows[0].p.name} (${club.name} ${rows[0].c.spellText || "years unknown"}).` },
        { q: `Who can I use for ${club.name} × ${nation} in a football grid?`, a: `Any player on this list fits ${article(club.name)} ${club.name} × ${nation} cell, for example ${listJoin(rows.slice(0, 2).map((r) => r.p.name))}.` },
      ];
      nationPages.push({
        key: `${slug}|${nslug}`,
        club: slug,
        nation,
        count: n,
        linkLabel: `${adj} players at ${club.name}`,
        note: `${n} players`,
        path,
        page: {
          path,
          title: titleFit(
            `${adj} Players Who Played for ${club.name} (${n}) | VerveQ`,
            `${adj} Players Who Played for ${club.name} (${n})`,
            `${adj} Players at ${club.name}`,
          ),
          description: `${n} ${adj} footballers who played for ${club.name}, with their years at the club, including ${listJoin(rows.slice(0, 3).map((r) => r.p.name))}. Football grid answers.`.slice(0, 155),
          breadcrumbs: crumbs,
          ogType: "article",
          jsonLd: [
            breadcrumbLd(crumbs),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${adj} players who played for ${club.name}`,
              numberOfItems: n,
              itemListElement: rows.map((r, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Person", name: r.p.name, nationality: nation, ...(r.p.qid ? { sameAs: `https://www.wikidata.org/wiki/${r.p.qid}` } : {}) } })),
            },
            faqLd(faqs),
          ],
          body: `<div class="seo-hero"><span class="seo-tag">Football grid answers</span>
<h1>${esc(adj)} players who played for ${esc(club.name)}</h1>
<p class="seo-lede"><strong>${n} ${esc(adj)} players</strong> in VerveQ's fact-checked database have played for ${esc(club.name)}. The most recent is <strong>${esc(rows[0].p.name)}</strong>.</p>
${cta("/v2/verve-grid?ref=seo_wpf", "Play the football grid")}</div>
<h2>All ${n} ${esc(adj)} ${esc(club.name)} players</h2>
<div class="seo-scroll"><table><thead><tr><th>Player</th><th>Years at ${esc(club.name)}</th><th>Position</th><th>Other clubs</th></tr></thead><tbody>${rows
            .map((r) => `<tr><td><strong>${esc(r.p.name)}</strong></td><td>${esc(r.c.spellText || "—")}</td><td>${esc(r.p.position ?? "—")}</td><td>${esc(r.p.clubs.filter((c) => c.slug !== slug).slice(0, 4).map((c) => c.name).join(", ") || "—")}</td></tr>`)
            .join("")}</tbody></table></div>
${faqSection(faqs)}
<div id="seo-related"></div>`,
        },
      });
    }
  }

  // ── Related links + club hubs ───────────────────────────────────────────
  const pagesByClub = new Map();
  for (const pp of pairPages) for (const c of pp.clubs) {
    if (!pagesByClub.has(c)) pagesByClub.set(c, []);
    pagesByClub.get(c).push(pp);
  }
  for (const np of nationPages) {
    if (!pagesByClub.has(np.club)) pagesByClub.set(np.club, []);
    pagesByClub.get(np.club).push(np);
  }
  const clubHubs = [];
  for (const [slug, club] of clubMeta) {
    const list = pagesByClub.get(slug) ?? [];
    if (club.players.length < CLUB_HUB_MIN || list.length < 3) continue;
    clubHubs.push({ slug, club, list });
  }
  const hubSlugs = new Set(clubHubs.map((h) => h.slug));
  const careerSets = buildCareerSets(clubMeta, careerPaths, quizQuestions, hubSlugs);
  const careerSetPaths = new Set(careerSets.sets.map((s) => s.path));

  const related = (pp) => {
    const clubs = pp.clubs ?? [pp.club];
    const out = [];
    for (const c of clubs) {
      for (const other of (pagesByClub.get(c) ?? []).sort((x, y) => y.count - x.count)) {
        if (other.path !== pp.path && !out.some((o) => o.href === other.path)) out.push({ href: other.path, label: other.linkLabel, note: other.note });
        if (out.length >= 12) break;
      }
    }
    const hubs = clubs.filter((c) => hubSlugs.has(c)).map((c) => ({ href: `/who-played-for/${c}/`, label: `All ${clubMeta.get(c).name} grid answers` }));
    return `<h2>Related grid answers</h2>${linkGrid([...hubs, ...out])}`;
  };
  for (const pp of [...pairPages, ...nationPages]) pp.page.body = pp.page.body.replace('<div id="seo-related"></div>', related(pp));

  const hubPages = clubHubs.map(({ slug, club, list }) => {
    const path = `/who-played-for/${slug}/`;
    const crumbs = [HOME, WPF, { name: club.name, path }];
    const pairsL = list.filter((x) => x.clubs).sort((a, b) => b.count - a.count);
    const natL = list.filter((x) => x.nation).sort((a, b) => b.count - a.count);
    const n = club.players.length;
    return {
      path,
      title: titleFit(`${club.name} Football Grid Answers — Who Played for ${club.name}? | VerveQ`, `${club.name} Grid Answers: Who Played for ${club.name}?`, `${club.name} Football Grid Answers`),
      description: `Football grid answers for ${club.name}: players who also played for ${listJoin(pairsL.slice(0, 3).map((p) => p.linkLabel.replace(`${club.name} and `, "").replace(` and ${club.name}`, "")))} and more, plus ${club.name} players by nationality.`.slice(0, 155),
      breadcrumbs: crumbs,
      jsonLd: [breadcrumbLd(crumbs)],
      body: `<div class="seo-hero"><span class="seo-tag">Club grid answers</span>
<h1>Who played for ${esc(club.name)}?</h1>
<p class="seo-lede">${n} players in VerveQ's fact-checked database played for ${esc(club.name)}. Use the pages below to find who fits ${article(club.name)} ${esc(club.name)} cell in a football grid, by the other club or by nationality.</p>
${cta("/v2/verve-grid?ref=seo_wpf", "Play the football grid")}</div>
${pairsL.length ? `<h2>${esc(club.name)} and another club</h2>${linkGrid(pairsL.map((p) => ({ href: p.path, label: p.linkLabel, note: p.note })))}` : ""}
${natL.length ? `<h2>${esc(club.name)} players by nationality</h2>${linkGrid(natL.map((p) => ({ href: p.path, label: p.linkLabel, note: p.note })))}` : ""}
${careerSetPaths.has(`/career-path-quiz/${slug}/`) ? `<h2>Guess ${esc(club.name)} players from their careers</h2>
<p>Think you know your ${esc(club.name)} history? Try the <a href="/career-path-quiz/${slug}/">${esc(club.name)} career path quiz</a>: ten players, their clubs in order, answers hidden.</p>` : ""}`,
    };
  });

  const wpfCrumbs = [HOME, WPF];
  const hubsSorted = [...clubHubs].sort((a, b) => b.club.players.length - a.club.players.length);
  const topPairs = [...pairPages].sort((a, b) => b.count - a.count);
  const wpfIndex = {
    path: "/who-played-for/",
    title: "Who Played for Both Clubs? Football Grid Answers | VerveQ",
    description: `Football grid answers: ${pairPages.length} club pairs and ${nationPages.length} club and nationality combinations, each with the players who fit and their years at each club.`,
    breadcrumbs: wpfCrumbs,
    jsonLd: [breadcrumbLd(wpfCrumbs)],
    body: `<div class="seo-hero"><span class="seo-tag">Football grid answers</span>
<h1>Who played for both clubs?</h1>
<p class="seo-lede">Stuck on a football grid cell? These pages list every player in VerveQ's fact-checked database who fits a club × club or club × nationality intersection, with their years at each club. ${pairPages.length} club pairs and ${nationPages.length} nationality combinations so far.</p>
${cta("/v2/verve-grid?ref=seo_wpf", "Play the football grid")}</div>
<h2>Browse by club</h2>
${linkGrid(hubsSorted.map((h) => ({ href: `/who-played-for/${h.slug}/`, label: h.club.name, note: `${h.club.players.length} players` })))}
<h2>Most common club pairs</h2>
${linkGrid(topPairs.slice(0, 30).map((p) => ({ href: p.path, label: p.linkLabel, note: p.note })))}`,
  };

  return {
    pages: [wpfIndex, ...hubPages, ...pairPages.map((p) => p.page), ...nationPages.map((p) => p.page), ...careerSets.pages],
    topPairPages: topPairs,
    careerSets: careerSets.sets,
    counts: { pairs: pairPages.length, nations: nationPages.length, hubs: hubPages.length, careerSets: careerSets.sets.length },
  };
}

const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 };

/** Deterministic pick: easy→hard mix, stable across builds. */
function pickTen(paths) {
  const sorted = [...paths].sort((a, b) => (DIFF_ORDER[a.difficulty] ?? 1) - (DIFF_ORDER[b.difficulty] ?? 1) || a.id.localeCompare(b.id));
  if (sorted.length <= 10) return sorted;
  const out = [];
  for (let i = 0; i < 10; i++) out.push(sorted[Math.floor((i * sorted.length) / 10)]);
  return out;
}

function renderPathQuiz(list) {
  return list
    .map(
      (cp, i) => `<div class="seo-q"><h3>Player ${i + 1} <span class="seo-note">(${esc(cp.difficulty ?? "medium")})</span></h3>
<div class="seo-path">${cp.clubs.map((c) => `<span class="seo-club">${esc(c)}</span>`).join('<span class="seo-arrow">→</span>')}</div>
<details class="seo-reveal"><summary>Reveal the player</summary><p><strong>${esc(cp.answerName)}</strong></p></details></div>`,
    )
    .join("\n");
}

// Extra spellings a question may use for a club (display name always counts).
const CLUB_ALIASES = {
  "manchester-united": ["Man Utd", "Man United"],
  "manchester-city": ["Man City"],
  "paris-saint-germain": ["PSG"],
  tottenham: ["Spurs", "Tottenham Hotspur"],
  "bayern-munich": ["Bayern"],
  barcelona: ["Barça", "FC Barcelona"],
  "atletico-madrid": ["Atletico Madrid"],
};

function questionsAboutClub(club, questions) {
  const names = [club.name, ...(CLUB_ALIASES[club.slug] ?? [])].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(^|[^\\p{L}])(${names.join("|")})(?![\\p{L}])`, "u");
  return questions.filter((q) => re.test(`${q.question} ${q.correctAnswer} ${q.explanation ?? ""}`));
}

function renderClubQuestions(qs) {
  const letters = ["A", "B", "C", "D", "E", "F"];
  return qs
    .map((q, i) => {
      const idx = q.options.indexOf(q.correctAnswer);
      return `<div class="seo-q"><h3>${i + 1}. ${esc(q.question)}</h3><ol>${q.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>
<details class="seo-reveal"><summary>Show answer</summary><p><strong>${idx >= 0 ? `${letters[idx]}: ` : ""}${esc(q.correctAnswer)}</strong>.${q.explanation ? ` ${esc(q.explanation)}` : ""}</p></details></div>`;
    })
    .join("\n");
}

function buildCareerSets(clubMeta, careerPaths, quizQuestions = [], hubSlugs = new Set()) {
  const sets = [];
  const pages = [];
  const cpById = new Map(careerPaths.map((c) => [c.id, c]));
  const clubs = [...clubMeta.values()]
    .map((c) => ({ ...c, paths: c.players.map((p) => cpById.get(p.id)).filter((cp) => cp && cp.clubs?.length >= 2) }))
    .filter((c) => c.paths.length >= 15)
    .sort((a, b) => b.paths.length - a.paths.length);

  const mk = ({ slug, name, h1, lede, list, tag, extra = "", titleOverride = null }) => {
    const path = `/career-path-quiz/${slug}/`;
    const crumbs = [HOME, CPQ, { name, path }];
    const faqs = [
      { q: "How does a career path quiz work?", a: "Each player is shown as the list of clubs he played for, in order. Name the player, then tap Reveal to check." },
      { q: "Can I play more career paths?", a: 'Yes. The <a href="/games/career-path/">Career Path game</a> has more than 1,300 careers, with scoring, three guesses per player and a 10 Path Challenge.' },
    ];
    pages.push({
      path,
      title: titleOverride ?? titleFit(`${h1} | VerveQ`, h1),
      description: `${lede} Ten players, including ${list[0].answerName}'s path, with answers hidden until you reveal them.`.slice(0, 155),
      breadcrumbs: crumbs,
      jsonLd: [breadcrumbLd(crumbs), faqLd(faqs)],
      body: `<div class="seo-hero"><span class="seo-tag">${esc(tag)}</span>
<h1>${esc(h1)}</h1>
<p class="seo-lede">${esc(lede)} Each player is shown as his clubs in order. Name him, then reveal the answer.</p>
${cta("/v2/career-path?ref=seo_cpq", "Play the full Career Path game")}</div>
${renderPathQuiz(list)}
${extra}
${faqSection(faqs)}
<div id="seo-cpq-links"></div>`,
    });
    sets.push({ path, linkLabel: name, note: tag });
  };

  for (const c of clubs.slice(0, 60)) {
    const qs = questionsAboutClub(c, quizQuestions).slice(0, 12);
    const extra = [
      qs.length
        ? `<h2>${esc(c.name)} quiz questions</h2><p>${qs.length} question${qs.length === 1 ? "" : "s"} about ${esc(c.name)} from VerveQ's <a href="/football-quiz/">daily football quiz archive</a>.</p>\n${renderClubQuestions(qs)}`
        : "",
      hubSlugs.has(c.slug)
        ? `<h2>Who played for ${esc(c.name)}?</h2><p>Grid answers for every club and nationality pairing: <a href="/who-played-for/${c.slug}/">${esc(c.name)} football grid answers</a>.</p>`
        : "",
    ].join("\n");
    mk({
      slug: c.slug,
      name: `${c.name} quiz`,
      h1: `${c.name} Quiz: Guess the Player From His Career`,
      titleOverride: titleFit(`${c.name} Quiz: Guess the Player From His Career | VerveQ`, `${c.name} Quiz: Career Paths${qs.length ? " and Questions" : ""} | VerveQ`, `${c.name} Quiz: Guess the Player | VerveQ`, `${c.name} Quiz | VerveQ`),
      lede: `Ten footballers who all played for ${c.name}, shown by their career paths${qs.length ? `, plus ${qs.length} ${c.name} quiz question${qs.length === 1 ? "" : "s"} with answers` : ""}.`,
      list: pickTen(c.paths),
      tag: qs.length ? `10 players · ${qs.length} questions` : "10 players",
      extra,
    });
  }
  for (const diff of ["easy", "medium", "hard"]) {
    const list = careerPaths.filter((cp) => cp.difficulty === diff && cp.clubs?.length >= 3);
    for (let part = 0; part < 3; part++) {
      const slice = pickTen(list.filter((_, i) => i % 3 === part));
      if (slice.length < 10) continue;
      const label = diff[0].toUpperCase() + diff.slice(1);
      mk({
        slug: `${diff}-${part + 1}`,
        name: `${label} career path quiz #${part + 1}`,
        h1: `${label} Football Career Path Quiz #${part + 1}`,
        lede: `Ten ${diff} career paths${diff === "hard" ? " for people who watch the lower leagues" : diff === "easy" ? " to warm up with" : ""}.`,
        list: slice,
        tag: `${label} · 10 players`,
      });
    }
  }

  // Index + cross-links.
  const crumbs = [HOME, CPQ];
  pages.push({
    path: "/career-path-quiz/",
    title: "Football Career Path Quiz — Guess the Player | VerveQ",
    description: `${sets.length} football career path quizzes by club and difficulty: see a player's clubs in order and guess who he is. Answers included.`,
    breadcrumbs: crumbs,
    jsonLd: [breadcrumbLd(crumbs)],
    body: `<div class="seo-hero"><span class="seo-tag">${sets.length} quizzes · answers included</span>
<h1>Football Career Path Quiz</h1>
<p class="seo-lede">Guess the footballer from his career path: the clubs he played for, in order. Every quiz has ten players with the answers hidden until you reveal them. Want scoring and a leaderboard? Play the full <a href="/games/career-path/">Career Path game</a>.</p>
${cta("/v2/career-path?ref=seo_cpq", "Play Career Path")}</div>
<h2>By difficulty</h2>
${linkGrid(sets.filter((s) => /Easy|Medium|Hard/.test(s.linkLabel)).map((s) => ({ href: s.path, label: s.linkLabel })))}
<h2>By club</h2>
${linkGrid(sets.filter((s) => !/Easy|Medium|Hard/.test(s.linkLabel)).map((s) => ({ href: s.path, label: s.linkLabel })))}`,
  });
  for (const p of pages) {
    p.body = p.body.replace(
      '<div id="seo-cpq-links"></div>',
      `<h2>More career path quizzes</h2>${linkGrid(sets.filter((s) => s.path !== p.path).slice(0, 12).map((s) => ({ href: s.path, label: s.linkLabel })))}<p><a href="/career-path-quiz/">All career path quizzes →</a></p>`,
    );
  }
  return { sets, pages };
}

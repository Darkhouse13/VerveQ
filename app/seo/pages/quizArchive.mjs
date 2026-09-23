/**
 * /football-quiz/ — every CLOSED daily quiz, with answers, plus topic pages
 * ("Premier League quiz questions") that regroup the same served questions.
 * Source: convex seoArchive:dailyQuizArchive (closed days only; today's quiz
 * never appears here).
 */
import { breadcrumbLd, cta, esc, faqLd, faqSection, linkGrid, ORIGIN } from "../lib.mjs";

const HOME = { name: "VerveQ", path: "/" };
const HUB = { name: "Football quiz", path: "/football-quiz/" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dateLabel(iso, { weekday = false, short = false } = {}) {
  const d = new Date(`${iso}T12:00:00Z`);
  const month = short ? MONTHS[d.getUTCMonth()].slice(0, 3) : MONTHS[d.getUTCMonth()];
  const base = `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
  return weekday ? `${DAYS[d.getUTCDay()]} ${base}` : base;
}

// Topic pages: served categories -> one evergreen page each.
export const TOPICS = [
  { slug: "premier-league-quiz-questions", name: "Premier League", cats: ["premier_league"], h1: "Premier League Quiz Questions and Answers" },
  { slug: "world-cup-quiz-questions", name: "World Cup", cats: ["world_cup", "world_cup_history", "world_cup_individual_feats"], h1: "World Cup Quiz Questions and Answers" },
  { slug: "champions-league-quiz-questions", name: "Champions League", cats: ["uefa_champions_league"], h1: "Champions League Quiz Questions and Answers" },
  { slug: "la-liga-quiz-questions", name: "La Liga", cats: ["la_liga"], h1: "La Liga Quiz Questions and Answers" },
  { slug: "serie-a-quiz-questions", name: "Serie A", cats: ["serie_a"], h1: "Serie A Quiz Questions and Answers" },
  { slug: "bundesliga-quiz-questions", name: "Bundesliga", cats: ["bundesliga"], h1: "Bundesliga Quiz Questions and Answers" },
  { slug: "ligue-1-quiz-questions", name: "Ligue 1", cats: ["ligue_1"], h1: "Ligue 1 Quiz Questions and Answers" },
  { slug: "eredivisie-quiz-questions", name: "Eredivisie", cats: ["eredivisie"], h1: "Eredivisie Quiz Questions and Answers" },
  { slug: "transfer-quiz-questions", name: "Transfers", cats: ["transfer_records", "transfers_history"], h1: "Football Transfer Quiz Questions and Answers" },
  { slug: "international-football-quiz-questions", name: "International football", cats: ["international", "national_team_records"], h1: "International Football Quiz Questions" },
  { slug: "euros-quiz-questions", name: "Euros", cats: ["euros_history"], h1: "Euros Quiz Questions and Answers" },
  { slug: "ballon-dor-quiz-questions", name: "Ballon d'Or", cats: ["ballon_dor", "ballon_dor_awards"], h1: "Ballon d'Or Quiz Questions and Answers" },
  { slug: "football-legends-quiz-questions", name: "Legends", cats: ["legends_messi_ronaldo", "legends_classic"], h1: "Football Legends Quiz Questions" },
  { slug: "womens-football-quiz-questions", name: "Women's football", cats: ["womens_football"], h1: "Women's Football Quiz Questions and Answers" },
  { slug: "football-stadium-quiz", name: "Stadiums", cats: ["stadium_identification"], h1: "Football Stadium Quiz: Name the Ground" },
  { slug: "guess-the-footballer-picture-quiz", name: "Guess the player", cats: ["player_silhouette"], h1: "Guess the Footballer From the Picture" },
  { slug: "football-badge-quiz", name: "Club badges", cats: ["badge_identification"], h1: "Football Badge Quiz: Name the Club" },
];
const MIN_TOPIC_QUESTIONS = 12;

function topicFor(category) {
  return TOPICS.find((t) => t.cats.includes(category)) ?? null;
}

function renderQuestion(q, n, { dateLink = null } = {}) {
  const letters = ["A", "B", "C", "D", "E", "F"];
  const opts = q.options.map((o) => `<li>${esc(o)}</li>`).join("");
  const img = q.imageUrl
    ? `<p><img src="${esc(q.imageUrl)}" alt="Question ${n} image" loading="lazy" decoding="async" width="400" height="240" style="width:100%;max-width:400px;height:240px;object-fit:contain;border:2px solid #121212;border-radius:8px;background:#fff"></p>`
    : "";
  const idx = q.options.indexOf(q.correctAnswer);
  const letter = idx >= 0 ? `${letters[idx]}: ` : "";
  const explanation = q.explanation ? ` ${esc(q.explanation)}` : "";
  const from = dateLink ? ` <span class="seo-note">(from the <a href="${dateLink.href}">${esc(dateLink.label)}</a> quiz)</span>` : "";
  return `<div class="seo-q"><h3>${n}. ${esc(q.question)}</h3>${img}<ol>${opts}</ol>
<details class="seo-reveal"><summary>Show answer</summary><p><strong>${letter}${esc(q.correctAnswer)}</strong>.${explanation}${from}</p></details></div>`;
}

export function buildQuizArchive(archive) {
  const days = [...(archive?.days ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const pages = [];
  if (days.length === 0) return { pages, recentDays: [], topicPages: [] };

  const recentDays = days.map((d) => ({ ...d, label: dateLabel(d.date) }));

  // ── Topic pages ──────────────────────────────────────────────────────────
  const topicPages = [];
  for (const topic of TOPICS) {
    const seen = new Set();
    const items = [];
    for (const day of days) {
      for (const q of day.questions) {
        if (!topic.cats.includes(q.category)) continue;
        const key = q.question.trim().toLowerCase() + "|" + (q.imageUrl ?? "");
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ q, date: day.date });
      }
    }
    if (items.length < MIN_TOPIC_QUESTIONS) continue;
    const path = `/football-quiz/${topic.slug}/`;
    const count = items.length;
    const crumbs = [HOME, HUB, { name: topic.name, path }];
    const faqs = [
      { q: `How many ${topic.name} quiz questions are there?`, a: `This page has ${count} ${topic.name} questions, all taken from VerveQ's daily football quiz, with the answer to every one.` },
      { q: "Where do the questions come from?", a: 'Every question was served in VerveQ\'s <a href="/games/daily-football-quiz/">daily football quiz</a>. New ones are added each day after that day\'s quiz closes.' },
      { q: "Can I use these questions for a pub quiz?", a: "Yes, go ahead. Tap Show answer on each question to reveal it, or play today's quiz yourself to test your own knowledge." },
    ];
    let title = `${topic.h1} (${count}) | VerveQ`;
    if (title.length > 60) title = `${topic.h1} | VerveQ`;
    if (title.length > 60) title = topic.h1;
    topicPages.push({
      topic,
      count,
      page: {
        path,
        title,
        description: `${count} ${topic.name} quiz questions with answers, taken from VerveQ's daily football quiz. Reveal each answer, then test yourself on today's quiz.`.slice(0, 155),
        breadcrumbs: crumbs,
        jsonLd: [breadcrumbLd(crumbs), faqLd(faqs)],
        body: `<div class="seo-hero"><span class="seo-tag">${count} questions · answers included</span>
<h1>${esc(topic.h1)}</h1>
<p class="seo-lede">${count} ${esc(topic.name)} questions, every one of them served in VerveQ's daily football quiz. Read the question, pick your answer, then tap <em>Show answer</em>. Updated every day as new quizzes close.</p>
${cta("/v2/daily?ref=seo_quiz_topic", "Play today's quiz")}</div>
${items.map((it, i) => renderQuestion(it.q, i + 1, { dateLink: { href: `/football-quiz/${it.date}/`, label: dateLabel(it.date) } })).join("\n")}
${faqSection(faqs)}
<h2>More football quiz topics</h2>
<div id="seo-topic-links"></div>`,
      },
    });
  }
  // Cross-links between topics (after we know which exist).
  const topicLinks = topicPages.map((t) => ({ href: t.page.path, label: `${t.topic.name} quiz`, note: `${t.count} questions` }));
  for (const t of topicPages) {
    t.page.body = t.page.body.replace('<div id="seo-topic-links"></div>', linkGrid(topicLinks.filter((l) => l.href !== t.page.path)));
    pages.push(t.page);
  }

  // ── One page per closed day ──────────────────────────────────────────────
  // The daily re-serves questions, so a day can be mostly repeats of earlier
  // days. Only days whose quiz is mostly NEW content are indexable; the rest
  // stay published (readers, internal links) as noindex and off the sitemap.
  const MIN_FRESH_FOR_INDEX = 5;
  const freshByDate = new Map();
  {
    const seen = new Set();
    for (const day of [...days].reverse()) {
      const keys = day.questions.map((q) => `${q.question}|${q.imageUrl ?? ""}`);
      freshByDate.set(day.date, keys.filter((k) => !seen.has(k)).length);
      keys.forEach((k) => seen.add(k));
    }
  }
  days.forEach((day, i) => {
    const indexable = freshByDate.get(day.date) >= MIN_FRESH_FOR_INDEX;
    const newer = days[i - 1];
    const older = days[i + 1];
    const path = `/football-quiz/${day.date}/`;
    const long = dateLabel(day.date, { weekday: true });
    const crumbs = [HOME, HUB, { name: dateLabel(day.date), path }];
    let title = `Football Quiz ${dateLabel(day.date)} — Questions & Answers | VerveQ`;
    if (title.length > 60) title = `Football Quiz ${dateLabel(day.date, { short: true })} — Questions & Answers`;
    const topics = [...new Set(day.questions.map((q) => topicFor(q.category)).filter(Boolean))].filter((t) =>
      topicPages.some((tp) => tp.topic.slug === t.slug),
    );
    const firstQ = day.questions[0]?.question ?? "";
    pages.push({
      path,
      title,
      description: `The VerveQ daily football quiz from ${long}: ${day.questions.length} questions with answers and explanations. ${firstQ}`.slice(0, 152).replace(/\s+\S*$/, "") + "…",
      breadcrumbs: crumbs,
      ogType: "article",
      ...(indexable ? {} : { robots: "noindex, follow", noSitemap: true }),
      jsonLd: [
        breadcrumbLd(crumbs),
        {
          "@context": "https://schema.org",
          "@type": "Quiz",
          name: `VerveQ daily football quiz — ${long}`,
          url: `${ORIGIN}${path}`,
          datePublished: day.date,
          educationalLevel: "general",
          about: { "@type": "Thing", name: "Association football" },
          numberOfQuestions: day.questions.length,
        },
      ],
      body: `<div class="seo-hero"><span class="seo-tag">${esc(long)}</span>
<h1>Football Quiz: ${esc(dateLabel(day.date))}</h1>
<p class="seo-lede">These are the ${day.questions.length} questions every VerveQ player faced in the daily football quiz on ${esc(long)}. Try them yourself, then reveal each answer. The live quiz only runs for one day; tomorrow's is always new.</p>
${cta("/v2/daily?ref=seo_quiz_day", "Play today's quiz")}</div>
${day.questions.map((q, n) => renderQuestion(q, n + 1)).join("\n")}
${topics.length ? `<h2>More questions like these</h2>${linkGrid(topics.map((t) => { const tp = topicPages.find((x) => x.topic.slug === t.slug); return { href: tp.page.path, label: `${t.name} quiz questions`, note: `${tp.count} questions` }; }))}` : ""}
<h2>Other days</h2>
${linkGrid([
  ...(newer ? [{ href: `/football-quiz/${newer.date}/`, label: `Next: ${dateLabel(newer.date)}` }] : []),
  ...(older ? [{ href: `/football-quiz/${older.date}/`, label: `Previous: ${dateLabel(older.date)}` }] : []),
  { href: "/football-quiz/", label: "All football quizzes", note: `${days.length} days of questions` },
])}`,
    });
  });

  // ── Hub ──────────────────────────────────────────────────────────────────
  const latest = days[0];
  const crumbs = [HOME, HUB];
  const byMonth = new Map();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(d);
  }
  const monthsHtml = [...byMonth.entries()]
    .map(([ym, list]) => {
      const [y, m] = ym.split("-");
      return `<h3>${MONTHS[Number(m) - 1]} ${y}</h3><p>${list
        .map((d) => `<a href="/football-quiz/${d.date}/">${Number(d.date.slice(8))} ${MONTHS[Number(m) - 1].slice(0, 3)}</a>`)
        .join(" · ")}</p>`;
    })
    .join("\n");
  const totalQuestions = days.reduce((n, d) => n + d.questions.length, 0);
  const hubFaqs = [
    { q: "Where do these football quiz questions come from?", a: "Every question here was served in VerveQ's daily football quiz. Each day's quiz is published with its answers once it closes at midnight UTC." },
    { q: "How many questions are there?", a: `${totalQuestions.toLocaleString("en")} questions across ${days.length} daily quizzes so far, and ten more every day.` },
    { q: "Can I play today's quiz?", a: 'Yes. <a href="/games/daily-football-quiz/">Today\'s daily football quiz</a> is free, takes about two minutes and needs no sign-up.' },
  ];
  pages.push({
    path: "/football-quiz/",
    title: "Football Quiz Questions and Answers — Daily Archive | VerveQ",
    description: `${totalQuestions.toLocaleString("en")} football quiz questions with answers: every VerveQ daily quiz since ${dateLabel(days[days.length - 1].date)}, plus quizzes by league and topic.`,
    breadcrumbs: crumbs,
    jsonLd: [breadcrumbLd(crumbs), faqLd(hubFaqs)],
    body: `<div class="seo-hero"><span class="seo-tag">${totalQuestions.toLocaleString("en")} questions · updated daily</span>
<h1>Football Quiz Questions and Answers</h1>
<p class="seo-lede">Every VerveQ daily football quiz, with the answers. Ten questions a day since ${esc(dateLabel(days[days.length - 1].date))}, covering the Premier League, the World Cup, transfers, legends and more. Use them for a pub quiz, a group chat or to warm up before today's quiz.</p>
${cta("/v2/daily?ref=seo_quiz_hub", "Play today's quiz")}</div>
<h2>Quizzes by topic</h2>
${linkGrid(topicLinks)}
<h2>Latest quiz: ${esc(dateLabel(latest.date, { weekday: true }))}</h2>
${latest.questions.map((q, n) => renderQuestion(q, n + 1)).join("\n")}
<p><a href="/football-quiz/${latest.date}/">Open the ${esc(dateLabel(latest.date))} quiz on its own page →</a></p>
<h2>Every daily quiz</h2>
${monthsHtml}
${faqSection(hubFaqs)}`,
  });

  return { pages, recentDays, topicPages };
}

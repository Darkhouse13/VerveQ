/**
 * French and Spanish quiz archives (/fr/quiz-foot/…, /es/quiz-futbol/…): the
 * same closed daily quizzes as /football-quiz/, translated. Translations live
 * in seo/translations/<lang>.json keyed by questionKey(); a day is published in
 * a language only when EVERY one of its questions is translated, so nothing
 * half-translated ships. Same indexing rule as English: a day is indexable only
 * if most of its questions are appearing for the first time.
 *
 * Returns the pages plus hreflang groups (day/topic/hub → {en, fr, es}).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { breadcrumbLd, cta, esc, faqLd, faqSection, linkGrid, ORIGIN } from "../lib.mjs";
import { TOPICS } from "./quizArchive.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function questionKey(q) {
  return createHash("sha1").update(`${q.question}\u0001${q.options.join("\u0001")}`).digest("hex").slice(0, 16);
}

function loadTranslations(lang) {
  const file = path.resolve(HERE, `../translations/${lang}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

const L = {
  fr: {
    base: "/fr/quiz-foot/",
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    days: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    dateLabel: (d, m, y) => `${d === 1 ? "1er" : d} ${m} ${y}`,
    home: "VerveQ",
    hubName: "Quiz foot",
    show: "Voir la réponse",
    imageAlt: (n) => `Image de la question ${n}`,
    play: "Jouer au quiz du jour",
    from: (href, label) => `(tirée du <a href="${href}">quiz du ${esc(label)}</a>)`,
    topicTag: (n) => `${n} questions · réponses incluses`,
    topicLede: (n, name) => `${n} questions sur ${name}, toutes posées dans le quiz foot du jour de VerveQ. Lis la question, choisis ta réponse, puis touche « Voir la réponse ». Mis à jour chaque jour.`,
    topicDesc: (n, name) => `${n} questions de quiz foot sur ${name} avec les réponses, tirées du quiz foot du jour de VerveQ. Teste-toi, puis joue au quiz d'aujourd'hui.`,
    topicLink: (name) => `Quiz ${name}`,
    nq: (n) => `${n} questions`,
    moreTopics: "Autres thèmes",
    dayTitle: (label) => [`Quiz foot du ${label} — questions et réponses | VerveQ`, `Quiz foot du ${label} — questions et réponses`, `Quiz foot du ${label} | VerveQ`],
    dayH1: (label) => `Quiz foot du ${label}`,
    dayLede: (n, long) => `Voici les ${n} questions du quiz foot du jour de VerveQ du ${long}, les mêmes pour tous les joueurs. Essaie-les, puis révèle chaque réponse. Le quiz en direct ne dure qu'un jour : celui de demain est toujours nouveau.`,
    dayDesc: (long, n, first) => `Le quiz foot VerveQ du ${long} : ${n} questions avec réponses et explications. ${first}`,
    similar: "D'autres questions du même genre",
    otherDays: "Autres jours",
    next: (l) => `Suivant : ${l}`,
    prev: (l) => `Précédent : ${l}`,
    all: "Tous les quiz foot",
    allNote: (n) => `${n} jours de questions`,
    hubTitle: "Quiz foot : questions et réponses — archives | VerveQ",
    hubH1: "Quiz foot : questions et réponses",
    hubTag: (n) => `${n} questions · mis à jour chaque jour`,
    hubLede: (first) => `Tous les quiz foot du jour de VerveQ, avec les réponses, depuis le ${first}. Ligue 1, Premier League, Coupe du monde, transferts, légendes… Parfait pour un quiz entre amis ou pour s'échauffer avant le quiz du jour.`,
    hubDesc: (n, first) => `${n} questions de quiz foot avec réponses : tous les quiz du jour de VerveQ depuis le ${first}, et des quiz par championnat et par thème.`,
    byTopic: "Quiz par thème",
    latest: (l) => `Dernier quiz : ${l}`,
    openDay: (l) => `Ouvrir le quiz du ${l} →`,
    everyDay: "Tous les quiz du jour",
    faqTopic: (n, name) => [
      { q: `Combien y a-t-il de questions sur ${name} ?`, a: `Cette page compte ${n} questions sur ${name}, toutes tirées du quiz foot du jour de VerveQ, avec la réponse à chacune.` },
      { q: "D'où viennent ces questions ?", a: 'Chaque question a été posée dans le <a href="/fr/jeux/quiz-foot-du-jour/">quiz foot du jour</a> de VerveQ. De nouvelles questions sont ajoutées chaque jour.' },
    ],
    faqHub: (total, days) => [
      { q: "D'où viennent ces questions de quiz foot ?", a: "Chaque question a été posée dans le quiz foot du jour de VerveQ. Le quiz de chaque jour est publié avec ses réponses après minuit UTC." },
      { q: "Combien y a-t-il de questions ?", a: `${total} questions réparties sur ${days} quiz du jour, et dix de plus chaque jour.` },
      { q: "Puis-je jouer au quiz d'aujourd'hui ?", a: 'Oui : le <a href="/fr/jeux/quiz-foot-du-jour/">quiz foot du jour</a> est gratuit, dure environ deux minutes et ne demande aucune inscription.' },
    ],
    topics: {
      "premier-league-quiz-questions": ["questions-premier-league", "Premier League", "Quiz Premier League : questions et réponses"],
      "world-cup-quiz-questions": ["questions-coupe-du-monde", "la Coupe du monde", "Quiz Coupe du monde : questions et réponses"],
      "champions-league-quiz-questions": ["questions-ligue-des-champions", "la Ligue des champions", "Quiz Ligue des champions : questions et réponses"],
      "la-liga-quiz-questions": ["questions-liga", "la Liga", "Quiz Liga : questions et réponses"],
      "serie-a-quiz-questions": ["questions-serie-a", "la Serie A", "Quiz Serie A : questions et réponses"],
      "bundesliga-quiz-questions": ["questions-bundesliga", "la Bundesliga", "Quiz Bundesliga : questions et réponses"],
      "ligue-1-quiz-questions": ["questions-ligue-1", "la Ligue 1", "Quiz Ligue 1 : questions et réponses"],
      "eredivisie-quiz-questions": ["questions-eredivisie", "l'Eredivisie", "Quiz Eredivisie : questions et réponses"],
      "transfer-quiz-questions": ["questions-transferts", "les transferts", "Quiz transferts foot : questions et réponses"],
      "international-football-quiz-questions": ["questions-equipes-nationales", "les équipes nationales", "Quiz équipes nationales : questions et réponses"],
      "euros-quiz-questions": ["questions-euro", "l'Euro", "Quiz Euro : questions et réponses"],
      "ballon-dor-quiz-questions": ["questions-ballon-d-or", "le Ballon d'Or", "Quiz Ballon d'Or : questions et réponses"],
      "football-legends-quiz-questions": ["questions-legendes-du-foot", "les légendes du foot", "Quiz légendes du foot : questions et réponses"],
      "womens-football-quiz-questions": ["questions-football-feminin", "le football féminin", "Quiz football féminin : questions et réponses"],
      "football-stadium-quiz": ["quiz-stades-de-foot", "les stades", "Quiz stades de foot : trouve le stade"],
      "guess-the-footballer-picture-quiz": ["quiz-devine-le-joueur-photo", "les joueurs en photo", "Quiz foot : devine le joueur sur la photo"],
      "football-badge-quiz": ["quiz-logos-clubs-de-foot", "les logos de clubs", "Quiz logos de clubs de foot"],
    },
  },
  es: {
    base: "/es/quiz-futbol/",
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    days: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    dateLabel: (d, m, y) => `${d} de ${m} de ${y}`,
    home: "VerveQ",
    hubName: "Quiz de fútbol",
    show: "Ver la respuesta",
    imageAlt: (n) => `Imagen de la pregunta ${n}`,
    play: "Jugar el quiz de hoy",
    from: (href, label) => `(del <a href="${href}">quiz del ${esc(label)}</a>)`,
    topicTag: (n) => `${n} preguntas · con respuestas`,
    topicLede: (n, name) => `${n} preguntas sobre ${name}, todas del quiz de fútbol diario de VerveQ. Lee la pregunta, elige tu respuesta y toca «Ver la respuesta». Se actualiza cada día.`,
    topicDesc: (n, name) => `${n} preguntas de fútbol sobre ${name} con respuestas, del quiz de fútbol diario de VerveQ. Ponte a prueba y juega el quiz de hoy.`,
    topicLink: (name) => `Quiz de ${name}`,
    nq: (n) => `${n} preguntas`,
    moreTopics: "Más temas",
    dayTitle: (label) => [`Quiz de fútbol del ${label} — con respuestas | VerveQ`, `Quiz de fútbol del ${label} — con respuestas`, `Quiz de fútbol del ${label}`],
    dayH1: (label) => `Quiz de fútbol del ${label}`,
    dayLede: (n, long) => `Estas son las ${n} preguntas del quiz de fútbol diario de VerveQ del ${long}, las mismas para todos los jugadores. Pruébalas y descubre cada respuesta. El quiz en directo solo dura un día: el de mañana siempre es nuevo.`,
    dayDesc: (long, n, first) => `El quiz de fútbol de VerveQ del ${long}: ${n} preguntas con respuestas y explicaciones. ${first}`,
    similar: "Más preguntas como estas",
    otherDays: "Otros días",
    next: (l) => `Siguiente: ${l}`,
    prev: (l) => `Anterior: ${l}`,
    all: "Todos los quiz de fútbol",
    allNote: (n) => `${n} días de preguntas`,
    hubTitle: "Preguntas de fútbol con respuestas — archivo | VerveQ",
    hubH1: "Preguntas de fútbol con respuestas",
    hubTag: (n) => `${n} preguntas · se actualiza cada día`,
    hubLede: (first) => `Todos los quiz de fútbol diarios de VerveQ, con las respuestas, desde el ${first}. LaLiga, Premier League, Mundial, fichajes, leyendas… Ideal para un quiz con amigos o para calentar antes del quiz de hoy.`,
    hubDesc: (n, first) => `${n} preguntas de fútbol con respuestas: todos los quiz diarios de VerveQ desde el ${first}, más quiz por liga y por tema.`,
    byTopic: "Quiz por tema",
    latest: (l) => `Último quiz: ${l}`,
    openDay: (l) => `Abrir el quiz del ${l} →`,
    everyDay: "Todos los quiz diarios",
    faqTopic: (n, name) => [
      { q: `¿Cuántas preguntas hay sobre ${name}?`, a: `Esta página tiene ${n} preguntas sobre ${name}, todas del quiz de fútbol diario de VerveQ, con la respuesta de cada una.` },
      { q: "¿De dónde salen las preguntas?", a: 'Cada pregunta apareció en el <a href="/es/juegos/quiz-de-futbol-diario/">quiz de fútbol diario</a> de VerveQ. Cada día se añaden preguntas nuevas.' },
    ],
    faqHub: (total, days) => [
      { q: "¿De dónde salen estas preguntas de fútbol?", a: "Cada pregunta apareció en el quiz de fútbol diario de VerveQ. El quiz de cada día se publica con sus respuestas después de medianoche UTC." },
      { q: "¿Cuántas preguntas hay?", a: `${total} preguntas en ${days} quiz diarios, y diez más cada día.` },
      { q: "¿Puedo jugar el quiz de hoy?", a: 'Sí: el <a href="/es/juegos/quiz-de-futbol-diario/">quiz de fútbol diario</a> es gratis, dura unos dos minutos y no necesita registro.' },
    ],
    topics: {
      "premier-league-quiz-questions": ["preguntas-premier-league", "la Premier League", "Quiz de la Premier League: preguntas y respuestas"],
      "world-cup-quiz-questions": ["preguntas-mundial", "el Mundial", "Quiz del Mundial: preguntas y respuestas"],
      "champions-league-quiz-questions": ["preguntas-champions-league", "la Champions League", "Quiz de la Champions: preguntas y respuestas"],
      "la-liga-quiz-questions": ["preguntas-laliga", "LaLiga", "Quiz de LaLiga: preguntas y respuestas"],
      "serie-a-quiz-questions": ["preguntas-serie-a", "la Serie A", "Quiz de la Serie A: preguntas y respuestas"],
      "bundesliga-quiz-questions": ["preguntas-bundesliga", "la Bundesliga", "Quiz de la Bundesliga: preguntas y respuestas"],
      "ligue-1-quiz-questions": ["preguntas-ligue-1", "la Ligue 1", "Quiz de la Ligue 1: preguntas y respuestas"],
      "eredivisie-quiz-questions": ["preguntas-eredivisie", "la Eredivisie", "Quiz de la Eredivisie: preguntas y respuestas"],
      "transfer-quiz-questions": ["preguntas-fichajes", "los fichajes", "Quiz de fichajes: preguntas y respuestas"],
      "international-football-quiz-questions": ["preguntas-selecciones", "las selecciones", "Quiz de selecciones: preguntas y respuestas"],
      "euros-quiz-questions": ["preguntas-eurocopa", "la Eurocopa", "Quiz de la Eurocopa: preguntas y respuestas"],
      "ballon-dor-quiz-questions": ["preguntas-balon-de-oro", "el Balón de Oro", "Quiz del Balón de Oro: preguntas y respuestas"],
      "football-legends-quiz-questions": ["preguntas-leyendas-del-futbol", "las leyendas del fútbol", "Quiz de leyendas del fútbol"],
      "womens-football-quiz-questions": ["preguntas-futbol-femenino", "el fútbol femenino", "Quiz de fútbol femenino: preguntas y respuestas"],
      "football-stadium-quiz": ["quiz-estadios-de-futbol", "los estadios", "Quiz de estadios de fútbol: adivina el estadio"],
      "guess-the-footballer-picture-quiz": ["quiz-adivina-el-futbolista-foto", "los futbolistas en foto", "Quiz: adivina el futbolista por la foto"],
      "football-badge-quiz": ["quiz-escudos-de-futbol", "los escudos", "Quiz de escudos de fútbol"],
    },
  },
};

function fit(cands) {
  return cands.find((t) => t.length <= 60) ?? cands[cands.length - 1];
}

/** Cut to ≤152 chars on a word boundary, with an ellipsis when cut. */
function clip(text) {
  if (text.length <= 155) return text;
  return text.slice(0, 152).replace(/\s+\S*$/, "") + "…";
}

export function buildIntlQuizArchive(archive, lang, { minFresh = 5, minTopic = 12 } = {}) {
  const loc = L[lang];
  const tr = loadTranslations(lang);
  const label = (iso, weekday = false) => {
    const d = new Date(`${iso}T12:00:00Z`);
    const s = loc.dateLabel(d.getUTCDate(), loc.months[d.getUTCMonth()], d.getUTCFullYear());
    return weekday ? `${loc.days[d.getUTCDay()]} ${s}` : s;
  };
  const translate = (q) => {
    const t = tr[questionKey(q)];
    if (!t || !Array.isArray(t.options) || t.options.length !== q.options.length) return null;
    const idx = q.options.indexOf(q.correctAnswer);
    if (idx < 0) return null;
    return { ...q, question: t.question, options: t.options, correctAnswer: t.options[idx], explanation: t.explanation ?? null };
  };

  const allDays = [...(archive?.days ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  // Freshness is judged on the full archive (a translated day can't be "new"
  // just because an earlier day is untranslated).
  const fresh = new Map();
  {
    const seen = new Set();
    for (const day of [...allDays].reverse()) {
      const keys = day.questions.map((q) => `${q.question}|${q.imageUrl ?? ""}`);
      fresh.set(day.date, keys.filter((k) => !seen.has(k)).length);
      keys.forEach((k) => seen.add(k));
    }
  }
  const days = allDays
    .map((d) => ({ ...d, tq: d.questions.map(translate) }))
    .filter((d) => d.tq.every(Boolean));
  const pages = [];
  const groups = [];
  if (days.length === 0) return { pages, groups, dayCount: 0 };

  const HOME = { name: loc.home, path: "/" };
  const HUB = { name: loc.hubName, path: loc.base };
  const letters = ["A", "B", "C", "D", "E", "F"];
  const renderQ = (q, n, from = null) => {
    const img = q.imageUrl
      ? `<p><img src="${esc(q.imageUrl)}" alt="${esc(loc.imageAlt(n))}" loading="lazy" decoding="async" width="400" height="240" style="width:100%;max-width:400px;height:240px;object-fit:contain;border:2px solid #121212;border-radius:8px;background:#fff"></p>`
      : "";
    const idx = q.options.indexOf(q.correctAnswer);
    return `<div class="seo-q"><h3>${n}. ${esc(q.question)}</h3>${img}<ol>${q.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>
<details class="seo-reveal"><summary>${esc(loc.show)}</summary><p><strong>${idx >= 0 ? `${letters[idx]}${lang === "fr" ? " : " : ": "}` : ""}${esc(q.correctAnswer)}</strong>.${q.explanation ? ` ${esc(q.explanation)}` : ""}${from ? ` <span class="seo-note">${from}</span>` : ""}</p></details></div>`;
  };

  // ── Topics ──
  const topicPages = [];
  for (const topic of TOPICS) {
    const [slug, name, h1] = loc.topics[topic.slug];
    const seen = new Set();
    const items = [];
    for (const day of days) {
      day.tq.forEach((q) => {
        if (!topic.cats.includes(q.category)) return;
        const key = `${q.question}|${q.imageUrl ?? ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ q, date: day.date });
      });
    }
    if (items.length < minTopic) continue;
    const p = `${loc.base}${slug}/`;
    const n = items.length;
    const crumbs = [HOME, HUB, { name: h1.split(":")[0].trim(), path: p }];
    const faqs = loc.faqTopic(n, name);
    topicPages.push({
      enSlug: topic.slug,
      name,
      count: n,
      page: {
        path: p,
        lang,
        title: fit([`${h1} (${n}) | VerveQ`, `${h1} | VerveQ`, h1]),
        description: clip(loc.topicDesc(n, name)),
        breadcrumbs: crumbs,
        jsonLd: [breadcrumbLd(crumbs), faqLd(faqs)],
        body: `<div class="seo-hero"><span class="seo-tag">${esc(loc.topicTag(n))}</span>
<h1>${esc(h1)}</h1>
<p class="seo-lede">${esc(loc.topicLede(n, name))}</p>
${cta(`/v2/daily?ref=seo_quiz_topic_${lang}`, loc.play)}</div>
${items.map((it, i) => renderQ(it.q, i + 1, loc.from(`${loc.base}${it.date}/`, label(it.date)))).join("\n")}
${faqSection(faqs, lang === "fr" ? "Questions fréquentes" : "Preguntas frecuentes")}
<h2>${esc(loc.moreTopics)}</h2>
<div id="seo-topic-links"></div>`,
      },
    });
  }
  const topicLinks = topicPages.map((t) => ({ href: t.page.path, label: loc.topicLink(t.name.replace(/^(la |le |l'|les |el |los |las )/i, "")), note: loc.nq(t.count) }));
  for (const t of topicPages) {
    t.page.body = t.page.body.replace('<div id="seo-topic-links"></div>', linkGrid(topicLinks.filter((l) => l.href !== t.page.path)));
    pages.push(t.page);
    groups.push({ key: `topic:${t.enSlug}`, lang, path: t.page.path, en: `/football-quiz/${t.enSlug}/` });
  }

  // ── Days ──
  days.forEach((day, i) => {
    const indexable = fresh.get(day.date) >= minFresh;
    const newer = days[i - 1];
    const older = days[i + 1];
    const p = `${loc.base}${day.date}/`;
    const long = label(day.date, true);
    const crumbs = [HOME, HUB, { name: label(day.date), path: p }];
    const topics = [...new Set(day.tq.map((q) => TOPICS.find((t) => t.cats.includes(q.category))?.slug).filter(Boolean))]
      .map((s) => topicPages.find((t) => t.enSlug === s))
      .filter(Boolean);
    pages.push({
      path: p,
      lang,
      title: fit(loc.dayTitle(label(day.date))),
      description: clip(loc.dayDesc(long, day.tq.length, day.tq[0].question)),
      breadcrumbs: crumbs,
      ogType: "article",
      ...(indexable ? {} : { robots: "noindex, follow", noSitemap: true }),
      jsonLd: [
        breadcrumbLd(crumbs),
        { "@context": "https://schema.org", "@type": "Quiz", name: loc.dayH1(label(day.date)), url: `${ORIGIN}${p}`, inLanguage: lang, datePublished: day.date, numberOfQuestions: day.tq.length },
      ],
      body: `<div class="seo-hero"><span class="seo-tag">${esc(long)}</span>
<h1>${esc(loc.dayH1(label(day.date)))}</h1>
<p class="seo-lede">${esc(loc.dayLede(day.tq.length, long))}</p>
${cta(`/v2/daily?ref=seo_quiz_day_${lang}`, loc.play)}</div>
${day.tq.map((q, n) => renderQ(q, n + 1)).join("\n")}
${topics.length ? `<h2>${esc(loc.similar)}</h2>${linkGrid(topics.map((t) => ({ href: t.page.path, label: loc.topicLink(t.name.replace(/^(la |le |l'|les |el |los |las )/i, "")), note: loc.nq(t.count) })))}` : ""}
<h2>${esc(loc.otherDays)}</h2>
${linkGrid([
  ...(newer ? [{ href: `${loc.base}${newer.date}/`, label: loc.next(label(newer.date)) }] : []),
  ...(older ? [{ href: `${loc.base}${older.date}/`, label: loc.prev(label(older.date)) }] : []),
  { href: loc.base, label: loc.all, note: loc.allNote(days.length) },
])}`,
    });
    groups.push({ key: `day:${day.date}`, lang, path: p, en: `/football-quiz/${day.date}/` });
  });

  // ── Hub ──
  const latest = days[0];
  const first = label(days[days.length - 1].date);
  const total = days.reduce((n, d) => n + d.tq.length, 0).toLocaleString(lang);
  const byMonth = new Map();
  for (const d of days) {
    const k = d.date.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(d);
  }
  const monthsHtml = [...byMonth.entries()]
    .map(([ym, list]) => {
      const [y, m] = ym.split("-");
      const mn = loc.months[Number(m) - 1];
      return `<h3>${mn[0].toUpperCase()}${mn.slice(1)} ${y}</h3><p>${list.map((d) => `<a href="${loc.base}${d.date}/">${Number(d.date.slice(8))} ${mn.slice(0, 4)}</a>`).join(" · ")}</p>`;
    })
    .join("\n");
  const hubCrumbs = [HOME, HUB];
  const faqs = loc.faqHub(total, days.length);
  pages.push({
    path: loc.base,
    lang,
    title: loc.hubTitle,
    description: clip(loc.hubDesc(total, first)),
    breadcrumbs: hubCrumbs,
    jsonLd: [breadcrumbLd(hubCrumbs), faqLd(faqs)],
    body: `<div class="seo-hero"><span class="seo-tag">${esc(loc.hubTag(total))}</span>
<h1>${esc(loc.hubH1)}</h1>
<p class="seo-lede">${esc(loc.hubLede(first))}</p>
${cta(`/v2/daily?ref=seo_quiz_hub_${lang}`, loc.play)}</div>
<h2>${esc(loc.byTopic)}</h2>
${linkGrid(topicLinks)}
<h2>${esc(loc.latest(label(latest.date, true)))}</h2>
${latest.tq.map((q, n) => renderQ(q, n + 1)).join("\n")}
<p><a href="${loc.base}${latest.date}/">${esc(loc.openDay(label(latest.date)))}</a></p>
<h2>${esc(loc.everyDay)}</h2>
${monthsHtml}
${faqSection(faqs, lang === "fr" ? "Questions fréquentes" : "Preguntas frecuentes")}`,
  });
  groups.push({ key: "hub", lang, path: loc.base, en: "/football-quiz/" });

  return { pages, groups, dayCount: days.length };
}

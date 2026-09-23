/**
 * French and Spanish game pages (/fr/jeux/…, /es/juegos/…). The app itself is
 * already translated (src/i18n/locales/{fr,es}); these pages give those
 * markets an indexable front door in their own words, tied to the English
 * pages with hreflang (see LANG_GROUPS, consumed by build.mjs).
 *
 * Copy is written for each language's search phrasing ("quiz foot", "grille
 * foot", "adivina el futbolista"), not translated word for word.
 */
import { cta, esc, faqLd, faqSection, breadcrumbLd, linkGrid, ORIGIN } from "../lib.mjs";

/** key -> path per language. x-default is the English page. */
export const LANG_GROUPS = {
  hub: { en: "/games/", fr: "/fr/jeux/", es: "/es/juegos/" },
  daily: { en: "/games/daily-football-quiz/", fr: "/fr/jeux/quiz-foot-du-jour/", es: "/es/juegos/quiz-de-futbol-diario/" },
  grid: { en: "/games/football-grid/", fr: "/fr/jeux/grille-foot/", es: "/es/juegos/grid-de-futbol/" },
  career: { en: "/games/career-path/", fr: "/fr/jeux/deviner-joueur-foot-carriere/", es: "/es/juegos/adivina-el-futbolista-por-su-trayectoria/" },
  hol: { en: "/games/higher-or-lower/", fr: "/fr/jeux/plus-ou-moins-foot/", es: "/es/juegos/mayor-o-menor-futbol/" },
  survival: { en: "/games/football-survival/", fr: "/fr/jeux/quiz-initiales-joueurs-foot/", es: "/es/juegos/quiz-iniciales-futbolistas/" },
  blitz: { en: "/games/60-second-football-quiz/", fr: "/fr/jeux/quiz-foot-60-secondes/", es: "/es/juegos/quiz-de-futbol-60-segundos/" },
  duels: { en: "/games/football-duels/", fr: "/fr/jeux/quiz-foot-entre-amis/", es: "/es/juegos/quiz-de-futbol-con-amigos/" },
};

const UI = {
  fr: {
    home: "VerveQ",
    hub: "Jeux",
    faq: "Questions fréquentes",
    more: "Plus de jeux de foot gratuits",
    free: "Gratuit, sans inscription, directement dans le navigateur.",
    nav: [
      { href: "/fr/jeux/", label: "Jeux de foot" },
      { href: "/games/", label: "English" },
      { href: "/es/juegos/", label: "Español" },
    ],
    footerIntro: "VerveQ : des jeux de quiz foot gratuits dans ton navigateur.",
  },
  es: {
    home: "VerveQ",
    hub: "Juegos",
    faq: "Preguntas frecuentes",
    more: "Más juegos de fútbol gratis",
    free: "Gratis, sin registro, directamente en el navegador.",
    nav: [
      { href: "/es/juegos/", label: "Juegos de fútbol" },
      { href: "/games/", label: "English" },
      { href: "/fr/jeux/", label: "Français" },
    ],
    footerIntro: "VerveQ: juegos de trivia de fútbol gratis en tu navegador.",
  },
};

export function uiFor(lang) {
  return UI[lang] ?? null;
}

const GAMES = {
  fr: [
    { key: "daily", label: "Quiz foot du jour", note: "10 questions, les mêmes pour tout le monde" },
    { key: "career", label: "Deviner le joueur", note: "Son parcours de clubs, à toi de trouver" },
    { key: "grid", label: "Grille foot", note: "Le morpion club × pays" },
    { key: "hol", label: "Plus ou moins", note: "Vraies stats de championnat" },
    { key: "survival", label: "Quiz des initiales", note: "Deux initiales, un joueur" },
    { key: "blitz", label: "Quiz foot 60 secondes", note: "Contre la montre" },
    { key: "duels", label: "Quiz foot entre amis", note: "Duel 1 contre 1 par lien" },
  ],
  es: [
    { key: "daily", label: "Quiz de fútbol diario", note: "10 preguntas, las mismas para todos" },
    { key: "career", label: "Adivina el futbolista", note: "Por su trayectoria de clubes" },
    { key: "grid", label: "Grid de fútbol", note: "El tres en raya club × país" },
    { key: "hol", label: "Mayor o menor", note: "Estadísticas reales de liga" },
    { key: "survival", label: "Quiz de iniciales", note: "Dos iniciales, un jugador" },
    { key: "blitz", label: "Quiz de 60 segundos", note: "Contra el reloj" },
    { key: "duels", label: "Quiz con amigos", note: "Duelo 1 contra 1 por enlace" },
  ],
};

function appLd(lang, name, path, description) {
  return {
    "@context": "https://schema.org",
    "@type": ["VideoGame", "WebApplication"],
    name,
    url: `${ORIGIN}${path}`,
    description,
    genre: ["Trivia", "Sports"],
    gamePlatform: ["Web browser", "Mobile web"],
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    inLanguage: lang,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    publisher: { "@type": "Organization", name: "VerveQ", url: ORIGIN },
  };
}

function page(lang, key, { name, title, description, body, faqs }) {
  const ui = UI[lang];
  const path = LANG_GROUPS[key][lang];
  const hubPath = LANG_GROUPS.hub[lang];
  const crumbs = key === "hub" ? [{ name: ui.home, path: "/" }, { name: ui.hub, path: hubPath }] : [{ name: ui.home, path: "/" }, { name: ui.hub, path: hubPath }, { name, path }];
  const others = GAMES[lang].filter((g) => g.key !== key).map((g) => ({ href: LANG_GROUPS[g.key][lang], label: g.label, note: g.note }));
  return {
    path,
    lang,
    title,
    description,
    breadcrumbs: crumbs,
    jsonLd: [...(key === "hub" ? [] : [appLd(lang, name, path, description)]), breadcrumbLd(crumbs), faqLd(faqs)],
    body: `${body}\n${key === "hub" ? "" : `<section><h2>${esc(ui.more)}</h2>${linkGrid(others)}</section>`}\n${faqSection(faqs, ui.faq)}`,
  };
}

export function buildIntlGamePages(ctx) {
  const out = [];
  const cp = ctx.careerSamples
    .map(
      (p, i) => `<div class="seo-q"><h3>#${i + 1}</h3><div class="seo-path">${p.clubs.map((c) => `<span class="seo-club">${esc(c)}</span>`).join('<span class="seo-arrow">→</span>')}</div>
<details class="seo-reveal"><summary>{{REVEAL}}</summary><p><strong>${esc(p.answerName)}</strong></p></details></div>`,
    )
    .join("\n");

  // ── Français ──────────────────────────────────────────────────────────────
  const fr = (key, def) => out.push(page("fr", key, def));
  fr("daily", {
    name: "Quiz foot du jour",
    title: "Quiz Foot du Jour — 10 Questions Chaque Jour | VerveQ",
    description: "Un quiz foot gratuit chaque jour : 10 questions, les mêmes pour tous les joueurs du monde, une seule tentative. Nouveau quiz à minuit UTC.",
    body: `<div class="seo-hero"><span class="seo-tag">Nouveau quiz à minuit UTC</span>
<h1>Quiz foot du jour</h1>
<p class="seo-lede">Chaque jour, VerveQ propose <strong>dix questions de foot, les mêmes pour tous les joueurs du monde</strong>. Une seule tentative. Réponds vite pour gagner plus de points, puis partage ton score avec tes potes.</p>
${cta("/v2/daily?ref=seo_daily_fr", "Jouer au quiz du jour")}
<p class="seo-note">${UI.fr.free}</p></div>
<h2>Comment ça marche</h2>
<ul>
<li><strong>10 questions, une tentative par jour.</strong> Pas de deuxième essai : ton score est ton score.</li>
<li><strong>Les mêmes questions pour tout le monde.</strong> Ton 8/10 et le 6/10 de ton pote sont directement comparables.</li>
<li><strong>La vitesse compte.</strong> Jusqu'à 100 points par question, qui baissent si tu réfléchis trop longtemps.</li>
<li><strong>Séries.</strong> Joue chaque jour pour garder ta série en vie.</li>
</ul>
<h2>Les thèmes</h2>
<p>Ligue 1, Premier League, Liga, Serie A, Bundesliga, Ligue des champions, Coupe du monde et Euro, records, transferts, entraîneurs : le quiz pioche dans une banque de questions vérifiées. Chaque jour mélange des questions faciles et une ou deux colles pour les vrais passionnés. Un 10/10 est rare.</p>
<p>Tu as raté un jour ? Tous les quiz passés sont publiés avec leurs réponses dans les <a href="/football-quiz/">archives du quiz (en anglais)</a>.</p>`,
    faqs: [
      { q: "À quelle heure change le quiz foot du jour ?", a: "Un nouveau quiz est publié chaque jour à minuit UTC, soit 2 h du matin en France l'été et 1 h l'hiver." },
      { q: "Le quiz est-il gratuit ?", a: "Oui, entièrement gratuit, et tu peux jouer sans créer de compte." },
      { q: "Le jeu est-il en français ?", a: "Oui, VerveQ est disponible en français, en anglais et en espagnol." },
    ],
  });
  fr("career", {
    name: "Deviner le joueur de foot par sa carrière",
    title: "Deviner le Joueur de Foot par sa Carrière — Quiz | VerveQ",
    description: "Jeu foot gratuit : on te montre le parcours d'un joueur club par club, tu dois deviner qui c'est. 3 essais, plus de 1 300 carrières vérifiées.",
    body: `<div class="seo-hero"><span class="seo-tag">Le jeu le plus joué</span>
<h1>Devine le joueur grâce à sa carrière</h1>
<p class="seo-lede">La liste des clubs d'un joueur, dans l'ordre. À toi de trouver qui a vécu cette carrière. Certains parcours sont évidents, d'autres sont des tours d'Europe qui séparent les fans des encyclopédies vivantes.</p>
${cta("/v2/career-path?ref=seo_career_fr", "Jouer au parcours carrière")}
<p class="seo-note">${UI.fr.free}</p></div>
<h2>Essaie maintenant</h2>
${cp.replace(/\{\{REVEAL\}\}/g, "Voir le joueur")}
<h2>Les règles</h2>
<ul>
<li><strong>Tout le parcours est affiché d'emblée.</strong> Lis, réfléchis, tape le nom.</li>
<li><strong>Trois essais par joueur.</strong> Chaque erreur réduit les points restants.</li>
<li><strong>Les fautes de frappe sont pardonnées.</strong> Pas d'autocomplétion, mais l'orthographe approximative passe.</li>
<li><strong>Deux modes.</strong> Un joueur à la fois sans chrono, ou le défi 10 parcours : 30 secondes par joueur, de plus en plus dur.</li>
</ul>`,
    faqs: [
      { q: "Comment jouer au quiz parcours carrière ?", a: "Tu vois les clubs d'un footballeur dans l'ordre chronologique et tu dois trouver son nom. Tu as trois essais par joueur." },
      { q: "Combien de joueurs y a-t-il ?", a: "Plus de 1 300 carrières vérifiées, des Ballons d'or aux joueurs cultes, transferts récents compris." },
      { q: "Faut-il écrire le nom parfaitement ?", a: "Non, les petites fautes sont acceptées. Mais il n'y a pas d'autocomplétion : il faut vraiment connaître le joueur." },
    ],
  });
  fr("grid", {
    name: "Grille foot",
    title: "Grille Foot — Le Morpion Football Club × Pays | VerveQ",
    description: "Jeu de grille foot gratuit : trouve un joueur qui correspond à la ligne et à la colonne (club, pays, poste). 9 cases, 9 essais, grilles illimitées.",
    body: `<div class="seo-hero"><span class="seo-tag">Défi 3×3</span>
<h1>Grille foot</h1>
<p class="seo-lede">Trois lignes, trois colonnes, neuf intersections. <strong>Chaque case attend un joueur qui colle aux deux en-têtes</strong> : il a joué dans ce club ET il a cette nationalité, ou il occupe ce poste. Neuf essais pour neuf cases, et chaque joueur ne sert qu'une fois.</p>
${cta("/v2/verve-grid?ref=seo_grid_fr", "Jouer à la grille")}
<p class="seo-note">Grilles faciles, moyennes et difficiles. Une nouvelle grille à chaque partie.</p></div>
<h2>Comment jouer</h2>
<ol>
<li><strong>Lis les en-têtes</strong> : clubs, pays ou postes.</li>
<li><strong>Choisis une case et tape un joueur</strong> qui correspond aux deux, par exemple un Brésilien passé par le Barça.</li>
<li><strong>Neuf essais au total.</strong> Une erreur brûle un essai sans remplir la case.</li>
<li><strong>Pas de doublon.</strong> Garde les grands voyageurs pour les cases difficiles.</li>
</ol>
<h2>Astuce</h2>
<p>Commence par la case la plus dure (petit club × petite nation) tant que tu as tous tes essais. Les cases faciles le resteront. Besoin d'aide ? Nos pages <a href="/who-played-for/">qui a joué pour les deux clubs</a> listent les joueurs des intersections les plus courantes.</p>`,
    faqs: [
      { q: "C'est quoi une grille foot ?", a: "Un morpion football : chaque ligne et chaque colonne est un club, un pays ou un poste, et tu remplis chaque case avec un joueur qui correspond aux deux." },
      { q: "Peut-on jouer plusieurs grilles par jour ?", a: "Oui, une nouvelle grille est générée à chaque partie. C'est illimité." },
      { q: "C'est gratuit ?", a: "Oui, totalement gratuit et sans inscription." },
    ],
  });
  fr("hol", {
    name: "Plus ou moins foot",
    title: "Plus ou Moins Foot — Le Jeu de Stats | VerveQ",
    description: "Jeu plus ou moins foot gratuit : la stat suivante est-elle plus haute ou plus basse ? Vraies stats de championnat par saison. Une erreur et c'est fini.",
    body: `<div class="seo-hero"><span class="seo-tag">Jeu de série</span>
<h1>Plus ou moins : foot</h1>
<p class="seo-lede">Une stat est révélée, la suivante est cachée. Plus ou moins ? Bonne réponse, ta série grimpe. Mauvaise réponse, c'est terminé : pas de vies, pas de seconde chance.</p>
${cta("/v2/higher-lower?ref=seo_hol_fr", "Jouer à plus ou moins")}
<p class="seo-note">${UI.fr.free}</p></div>
<h2>Comment ça marche</h2>
<ul>
<li><strong>De vraies stats, de vraies saisons.</strong> Buts marqués, buts encaissés, points… championnat par championnat, saison par saison.</li>
<li><strong>Enchaîne.</strong> Chaque bonne réponse devient ta nouvelle référence.</li>
<li><strong>Une erreur et c'est fini.</strong> Ta série finale est ton score.</li>
<li><strong>Trois niveaux.</strong> Facile, moyen, difficile.</li>
</ul>`,
    faqs: [
      { q: "Comment jouer à plus ou moins foot ?", a: "Tu vois une statistique et tu devines si la suivante est plus haute ou plus basse. Une seule erreur termine la partie." },
      { q: "Quelles stats sont utilisées ?", a: "De vraies statistiques de championnat par saison : buts marqués, buts encaissés, points, dans les grands championnats européens." },
    ],
  });
  fr("survival", {
    name: "Quiz des initiales de joueurs de foot",
    title: "Quiz Initiales Joueurs de Foot — Mode Survie | VerveQ",
    description: "Quiz foot gratuit : on te donne deux initiales, tu cites n'importe quel joueur qui correspond. Plus de 30 000 joueurs acceptés, trois vies.",
    body: `<div class="seo-hero"><span class="seo-tag">Mode survie</span>
<h1>Quiz des initiales</h1>
<p class="seo-lede">La règle tient en une phrase : <strong>deux initiales, tu cites un footballeur qui les porte</strong>. « KM » ? Kylian Mbappé marche. N'importe quel autre joueur pro aux mêmes initiales aussi. Tiens le plus longtemps possible.</p>
${cta("/v2/daily-survival?ref=seo_survival_fr", "Jouer au défi du jour")}
<p class="seo-note">Le défi du jour est le même pour tout le monde. Une tentative.</p></div>
<h2>Les règles</h2>
<ul>
<li><strong>Deux initiales par manche.</strong> Plus de 30 000 joueurs sont acceptés.</li>
<li><strong>Trois vies.</strong> Une erreur en coûte une ; une faute de frappe, non.</li>
<li><strong>Ça se corse.</strong> Les premières manches veulent des stars, les suivantes récompensent ceux qui connaissent les défenses de Ligue 2.</li>
</ul>`,
    faqs: [
      { q: "Comment marche le quiz des initiales ?", a: "Chaque manche affiche deux initiales et tu cites un footballeur professionnel dont le prénom et le nom commencent par ces lettres." },
      { q: "N'importe quel joueur compte ?", a: "Oui, il n'y a pas une seule bonne réponse : plus de 30 000 joueurs sont acceptés." },
    ],
  });
  fr("blitz", {
    name: "Quiz foot 60 secondes",
    title: "Quiz Foot 60 Secondes — Contre la Montre | VerveQ",
    description: "Quiz foot chronométré gratuit : réponds à un maximum de questions en 60 secondes. Chaque mauvaise réponse coûte 3 secondes.",
    body: `<div class="seo-hero"><span class="seo-tag">Chrono</span>
<h1>Quiz foot en 60 secondes</h1>
<p class="seo-lede">Une minute au chrono. <strong>Réponds à un maximum de questions avant zéro.</strong> Chaque bonne réponse fait monter ton score ; chaque erreur te retire trois secondes.</p>
${cta("/v2/blitz?ref=seo_blitz_fr", "Lancer le chrono")}
<p class="seo-note">${UI.fr.free}</p></div>
<h2>Les règles</h2>
<ul>
<li><strong>60 secondes</strong>, le chrono démarre à la première question.</li>
<li><strong>QCM</strong> : quatre réponses possibles.</li>
<li><strong>−3 secondes</strong> par mauvaise réponse : répondre au hasard ne paie pas.</li>
</ul>`,
    faqs: [
      { q: "Combien de temps dure le quiz ?", a: "Exactement 60 secondes." },
      { q: "Que se passe-t-il si je me trompe ?", a: "Tu perds 3 secondes sur le chrono." },
    ],
  });
  fr("duels", {
    name: "Quiz foot entre amis",
    title: "Quiz Foot Entre Amis — Duel en Ligne 1 contre 1 | VerveQ",
    description: "Joue à un quiz foot entre amis : envoie un lien de duel, vous répondez aux mêmes questions, la carte de résultat tranche. Gratuit, sans compte.",
    body: `<div class="seo-hero"><span class="seo-tag">Multijoueur</span>
<h1>Quiz foot entre amis</h1>
<p class="seo-lede">Dans chaque groupe il y a celui qui est sûr d'en savoir plus que toi. Le duel règle ça : choisis un thème, envoie le lien, et vous affrontez <strong>exactement les mêmes questions</strong>.</p>
${cta("/v2/duels?ref=seo_duels_fr", "Lancer un duel")}
<p class="seo-note">Pour jouer à plusieurs en même temps, crée une salle Arena.</p></div>
<h2>Comment ça marche</h2>
<ul>
<li><strong>En différé.</strong> Tu joues maintenant, ton pote joue quand il ouvre le lien.</li>
<li><strong>Mêmes questions.</strong> Personne n'a la série facile.</li>
<li><strong>Pas de compte pour accepter.</strong> Il clique et il joue.</li>
<li><strong>Historique des duels.</strong> Victoires, défaites, séries.</li>
</ul>`,
    faqs: [
      { q: "Comment jouer à un quiz foot avec des amis en ligne ?", a: "Lance un duel sur VerveQ et envoie le lien. Vous répondez aux mêmes questions et la carte de résultat désigne le vainqueur." },
      { q: "Mon ami doit-il créer un compte ?", a: "Non, il peut jouer directement en invité." },
    ],
  });
  out.push(
    page("fr", "hub", {
      name: "Jeux",
      title: "Jeux de Foot Gratuits en Ligne — Quiz Foot | VerveQ",
      description: "Jeux de foot gratuits dans le navigateur : quiz foot du jour, deviner le joueur par sa carrière, grille foot, plus ou moins, duels entre amis.",
      body: `<div class="seo-hero"><span class="seo-tag">Gratuit · sans téléchargement</span>
<h1>Jeux de foot gratuits</h1>
<p class="seo-lede">Sept jeux de foot à lancer tout de suite dans ton navigateur, pensés pour ceux qui regardent vraiment les matchs. Choisis-en un et joue : sans téléchargement, et la plupart sans compte.</p>
${cta("/v2/career-path?ref=seo_games_fr", "Jouer au jeu le plus populaire")}</div>
<h2>Tous les jeux</h2>
${linkGrid(GAMES.fr.map((g) => ({ href: LANG_GROUPS[g.key].fr, label: g.label, note: g.note })))}`,
      faqs: [
        { q: "Les jeux VerveQ sont-ils gratuits ?", a: "Oui, tous les jeux sont gratuits et se jouent dans le navigateur." },
        { q: "Les jeux sont-ils en français ?", a: "Oui, l'application est entièrement disponible en français." },
      ],
    }),
  );

  // ── Español ───────────────────────────────────────────────────────────────
  const es = (key, def) => out.push(page("es", key, def));
  es("daily", {
    name: "Quiz de fútbol diario",
    title: "Quiz de Fútbol Diario — 10 Preguntas Cada Día | VerveQ",
    description: "Un quiz de fútbol gratis cada día: 10 preguntas, las mismas para todos los jugadores del mundo, un solo intento. Nuevo quiz a medianoche UTC.",
    body: `<div class="seo-hero"><span class="seo-tag">Nuevo quiz a medianoche UTC</span>
<h1>Quiz de fútbol diario</h1>
<p class="seo-lede">Cada día VerveQ publica <strong>diez preguntas de fútbol, las mismas para todo el mundo</strong>. Un solo intento. Responde rápido para sumar más puntos y comparte tu resultado con tus amigos.</p>
${cta("/v2/daily?ref=seo_daily_es", "Jugar el quiz de hoy")}
<p class="seo-note">${UI.es.free}</p></div>
<h2>Cómo funciona</h2>
<ul>
<li><strong>10 preguntas, un intento al día.</strong> Sin repeticiones.</li>
<li><strong>Las mismas preguntas para todos.</strong> Tu 8/10 y el 6/10 de tu amigo se pueden comparar.</li>
<li><strong>La velocidad cuenta.</strong> Hasta 100 puntos por pregunta, que bajan cuanto más tardas.</li>
<li><strong>Rachas.</strong> Juega cada día para mantener tu racha.</li>
</ul>
<h2>Temas</h2>
<p>LaLiga, Premier League, Serie A, Bundesliga, Ligue 1, Champions League, Mundial, Eurocopa, Copa Libertadores, fichajes y récords: el quiz sale de un banco de preguntas verificadas, con preguntas fáciles y alguna reservada a los más futboleros.</p>
<p>¿Te perdiste un día? Todos los quiz anteriores están publicados con sus respuestas en el <a href="/football-quiz/">archivo del quiz (en inglés)</a>.</p>`,
    faqs: [
      { q: "¿A qué hora cambia el quiz de fútbol diario?", a: "Cada día a medianoche UTC se publica un quiz nuevo." },
      { q: "¿Es gratis?", a: "Sí, totalmente gratis y puedes jugar sin crear una cuenta." },
      { q: "¿Está en español?", a: "Sí, VerveQ está disponible en español, inglés y francés." },
    ],
  });
  es("career", {
    name: "Adivina el futbolista por su trayectoria",
    title: "Adivina el Futbolista por su Trayectoria — Quiz | VerveQ",
    description: "Juego de fútbol gratis: ves los clubes de un jugador en orden y tienes que adivinar quién es. Tres intentos y más de 1.300 trayectorias verificadas.",
    body: `<div class="seo-hero"><span class="seo-tag">El juego más jugado</span>
<h1>Adivina el futbolista por su trayectoria</h1>
<p class="seo-lede">La lista de clubes de un jugador, en orden cronológico. Tú dices quién es. Algunas trayectorias son regalos; otras son vueltas por media Europa que separan a los aficionados de las enciclopedias.</p>
${cta("/v2/career-path?ref=seo_career_es", "Jugar a adivinar el jugador")}
<p class="seo-note">${UI.es.free}</p></div>
<h2>Pruébalo ahora</h2>
${cp.replace(/\{\{REVEAL\}\}/g, "Ver el jugador")}
<h2>Reglas</h2>
<ul>
<li><strong>Toda la trayectoria desde el principio.</strong> Lee, piensa y escribe.</li>
<li><strong>Tres intentos por jugador.</strong> Cada fallo reduce los puntos.</li>
<li><strong>Se perdonan las erratas.</strong> Sin autocompletar: tienes que saberlo tú.</li>
<li><strong>Dos modos.</strong> Uno a uno sin reloj, o el reto de 10 trayectorias con 30 segundos cada una.</li>
</ul>`,
    faqs: [
      { q: "¿Cómo se juega a adivinar el futbolista por su trayectoria?", a: "Ves los clubes de un futbolista en orden y tienes tres intentos para decir su nombre." },
      { q: "¿Cuántos jugadores hay?", a: "Más de 1.300 trayectorias verificadas, con los fichajes recientes incluidos." },
    ],
  });
  es("grid", {
    name: "Grid de fútbol",
    title: "Grid de Fútbol — Tres en Raya Club × País | VerveQ",
    description: "Juego de grid de fútbol gratis: nombra un jugador que encaje en la fila y la columna (club, país o posición). 9 casillas, 9 intentos, ilimitado.",
    body: `<div class="seo-hero"><span class="seo-tag">Reto 3×3</span>
<h1>Grid de fútbol</h1>
<p class="seo-lede">Tres filas, tres columnas, nueve cruces. <strong>Cada casilla necesita un jugador que cumpla los dos encabezados</strong>: jugó en ese club Y tiene esa nacionalidad, o juega en esa posición. Nueve intentos para nueve casillas, sin repetir jugadores.</p>
${cta("/v2/verve-grid?ref=seo_grid_es", "Jugar al grid")}
<p class="seo-note">Grids fáciles, medios y difíciles. Uno nuevo en cada partida.</p></div>
<h2>Cómo se juega</h2>
<ol>
<li><strong>Lee los encabezados:</strong> clubes, países o posiciones.</li>
<li><strong>Elige una casilla y escribe un jugador</strong> que encaje en ambos, por ejemplo un argentino que jugó en el Real Madrid.</li>
<li><strong>Nueve intentos en total.</strong> Un fallo gasta un intento.</li>
<li><strong>Sin repetir.</strong> Guarda a los trotamundos para las casillas difíciles.</li>
</ol>
<p>¿Atascado? Nuestras páginas <a href="/who-played-for/">quién jugó en ambos clubes</a> listan jugadores para los cruces más habituales.</p>`,
    faqs: [
      { q: "¿Qué es un grid de fútbol?", a: "Un tres en raya futbolero: cada fila y columna es un club, país o posición, y rellenas cada casilla con un jugador que cumpla ambos." },
      { q: "¿Puedo jugar más de un grid al día?", a: "Sí, se genera un grid nuevo en cada partida." },
    ],
  });
  es("hol", {
    name: "Mayor o menor fútbol",
    title: "Mayor o Menor Fútbol — Juego de Estadísticas | VerveQ",
    description: "Juego de mayor o menor de fútbol gratis: ¿la siguiente estadística es mayor o menor? Datos reales de liga por temporada. Un fallo y se acabó.",
    body: `<div class="seo-hero"><span class="seo-tag">Juego de rachas</span>
<h1>Mayor o menor: fútbol</h1>
<p class="seo-lede">Se muestra una estadística y la siguiente está oculta. ¿Mayor o menor? Si aciertas, tu racha sigue; si fallas, se acabó.</p>
${cta("/v2/higher-lower?ref=seo_hol_es", "Jugar a mayor o menor")}
<p class="seo-note">${UI.es.free}</p></div>
<h2>Cómo funciona</h2>
<ul>
<li><strong>Estadísticas reales por temporada:</strong> goles a favor, goles en contra, puntos.</li>
<li><strong>Encadena aciertos.</strong> Cada acierto es tu nueva referencia.</li>
<li><strong>Un fallo termina la partida.</strong> Tu racha es tu puntuación.</li>
</ul>`,
    faqs: [
      { q: "¿Cómo se juega a mayor o menor de fútbol?", a: "Ves una estadística y adivinas si la siguiente es mayor o menor. Un solo fallo termina la partida." },
    ],
  });
  es("survival", {
    name: "Quiz de iniciales de futbolistas",
    title: "Quiz de Iniciales de Futbolistas — Supervivencia | VerveQ",
    description: "Quiz de fútbol gratis: te damos dos iniciales y nombras cualquier jugador que encaje. Más de 30.000 jugadores válidos y tres vidas.",
    body: `<div class="seo-hero"><span class="seo-tag">Supervivencia</span>
<h1>Quiz de iniciales de futbolistas</h1>
<p class="seo-lede">La regla cabe en una frase: <strong>dos iniciales y nombras un futbolista que las tenga</strong>. ¿«LM»? Lionel Messi vale, y cualquier otro profesional con esas iniciales también.</p>
${cta("/v2/daily-survival?ref=seo_survival_es", "Jugar el reto de hoy")}
<p class="seo-note">El reto diario es el mismo para todos. Un intento.</p></div>
<h2>Reglas</h2>
<ul>
<li><strong>Dos iniciales por ronda.</strong> Más de 30.000 jugadores son válidos.</li>
<li><strong>Tres vidas.</strong> Un fallo cuesta una; una errata, no.</li>
<li><strong>Cada vez más difícil.</strong> Primero estrellas, después los que solo conocen los muy futboleros.</li>
</ul>`,
    faqs: [
      { q: "¿Cómo funciona el quiz de iniciales?", a: "Cada ronda muestra dos iniciales y nombras un futbolista profesional cuyo nombre y apellido empiecen por ellas." },
    ],
  });
  es("blitz", {
    name: "Quiz de fútbol de 60 segundos",
    title: "Quiz de Fútbol de 60 Segundos — Contra el Reloj | VerveQ",
    description: "Quiz de fútbol cronometrado gratis: responde tantas preguntas como puedas en 60 segundos. Cada respuesta incorrecta resta 3 segundos.",
    body: `<div class="seo-hero"><span class="seo-tag">Contrarreloj</span>
<h1>Quiz de fútbol en 60 segundos</h1>
<p class="seo-lede">Un minuto en el reloj. <strong>Responde tantas preguntas como puedas antes de llegar a cero.</strong> Cada fallo resta tres segundos.</p>
${cta("/v2/blitz?ref=seo_blitz_es", "Empezar el reto")}
<p class="seo-note">${UI.es.free}</p></div>
<h2>Reglas</h2>
<ul>
<li><strong>60 segundos</strong> desde la primera pregunta.</li>
<li><strong>Opción múltiple</strong> con cuatro respuestas.</li>
<li><strong>−3 segundos</strong> por respuesta incorrecta.</li>
</ul>`,
    faqs: [{ q: "¿Cuánto dura el quiz?", a: "Exactamente 60 segundos." }],
  });
  es("duels", {
    name: "Quiz de fútbol con amigos",
    title: "Quiz de Fútbol con Amigos — Duelos 1 contra 1 | VerveQ",
    description: "Juega un quiz de fútbol con amigos online: envía un enlace de duelo, respondéis las mismas preguntas y la tarjeta de resultado decide. Gratis.",
    body: `<div class="seo-hero"><span class="seo-tag">Multijugador</span>
<h1>Quiz de fútbol con amigos</h1>
<p class="seo-lede">En cada grupo hay uno que está seguro de saber más de fútbol que tú. El duelo lo decide: elige tema, envía el enlace y os enfrentáis a <strong>las mismas preguntas</strong>.</p>
${cta("/v2/duels?ref=seo_duels_es", "Empezar un duelo")}
<p class="seo-note">Para jugar en grupo, crea una sala Arena.</p></div>
<h2>Cómo funciona</h2>
<ul>
<li><strong>Sin quedar a una hora.</strong> Tú juegas ahora, tu amigo cuando abra el enlace.</li>
<li><strong>Las mismas preguntas.</strong> Nadie tiene la tanda fácil.</li>
<li><strong>Sin cuenta para aceptar.</strong> Abre el enlace y juega.</li>
</ul>`,
    faqs: [
      { q: "¿Cómo jugar un quiz de fútbol con amigos online?", a: "Crea un duelo en VerveQ y envía el enlace. Respondéis las mismas preguntas y la tarjeta de resultado muestra quién ganó." },
      { q: "¿Mi amigo necesita una cuenta?", a: "No, puede jugar directamente como invitado." },
    ],
  });
  out.push(
    page("es", "hub", {
      name: "Juegos",
      title: "Juegos de Fútbol Gratis Online — Quiz de Fútbol | VerveQ",
      description: "Juegos de fútbol gratis en el navegador: quiz diario, adivina el futbolista por su trayectoria, grid de fútbol, mayor o menor y duelos con amigos.",
      body: `<div class="seo-hero"><span class="seo-tag">Gratis · sin descargas</span>
<h1>Juegos de fútbol gratis</h1>
<p class="seo-lede">Siete juegos de fútbol para jugar ya en tu navegador, pensados para quien ve los partidos de verdad. Sin descargas y, la mayoría, sin cuenta.</p>
${cta("/v2/career-path?ref=seo_games_es", "Jugar al más popular")}</div>
<h2>Todos los juegos</h2>
${linkGrid(GAMES.es.map((g) => ({ href: LANG_GROUPS[g.key].es, label: g.label, note: g.note })))}`,
      faqs: [
        { q: "¿Los juegos de VerveQ son gratis?", a: "Sí, todos los juegos son gratis y se juegan en el navegador." },
        { q: "¿Están en español?", a: "Sí, la aplicación está disponible en español." },
      ],
    }),
  );
  return out;
}

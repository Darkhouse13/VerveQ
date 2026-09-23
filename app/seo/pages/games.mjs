/**
 * The /games/ layer: one indexable page per game mode plus the hub.
 *
 * Each page targets the query family its SERP rewards (see the 2026-09-23
 * SERP research): the page itself is the launcher — the CTA opens the real game
 * client-side with no reload — and carries the how-to, a worked sample, tips
 * and an FAQ as server-rendered HTML.
 */
import {
  cta,
  esc,
  faqLd,
  faqSection,
  breadcrumbLd,
  linkGrid,
  ORIGIN,
} from "../lib.mjs";

const GAMES_CRUMB = { name: "Games", path: "/games/" };
const HOME_CRUMB = { name: "VerveQ", path: "/" };

function appLd({ name, path, description, genre }) {
  return {
    "@context": "https://schema.org",
    "@type": ["VideoGame", "WebApplication"],
    name,
    url: `${ORIGIN}${path}`,
    description,
    genre: genre ?? ["Trivia", "Sports", "Puzzle"],
    gamePlatform: ["Web browser", "Mobile web"],
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "VerveQ", url: ORIGIN },
  };
}

function gamePage({ slug, title, description, ogTitle, ogDescription, name, genre, body, faqs }) {
  const path = `/games/${slug}/`;
  const crumbs = [HOME_CRUMB, GAMES_CRUMB, { name, path }];
  return {
    path,
    title,
    description,
    ogTitle,
    ogDescription,
    breadcrumbs: crumbs,
    jsonLd: [appLd({ name, path, description, genre }), breadcrumbLd(crumbs), faqLd(faqs)],
    body: `${body}\n${faqSection(faqs)}`,
  };
}

const MORE_GAMES = [
  { href: "/games/daily-football-quiz/", label: "Daily Football Quiz", note: "10 new questions every day" },
  { href: "/games/career-path/", label: "Guess the Footballer", note: "Name the player from his clubs" },
  { href: "/games/football-grid/", label: "Football Grid", note: "3×3 club and country puzzle" },
  { href: "/games/higher-or-lower/", label: "Higher or Lower", note: "Football stats streak game" },
  { href: "/games/football-survival/", label: "Footballer Initials Quiz", note: "Two initials, name a player" },
  { href: "/games/60-second-football-quiz/", label: "60-Second Football Quiz", note: "Beat the clock" },
  { href: "/games/football-duels/", label: "Football Quiz With Friends", note: "1v1 duels by link" },
];

function moreGames(exceptSlug) {
  return `<section><h2>More free football games</h2>${linkGrid(
    MORE_GAMES.filter((g) => !g.href.includes(`/${exceptSlug}/`)),
  )}</section>`;
}

function careerPathSample(ctx) {
  const picks = ctx.careerSamples;
  return picks
    .map(
      (p, i) => `<div class="seo-q"><h3>Player ${i + 1} <span class="seo-note">(${esc(p.difficulty)})</span></h3>
<div class="seo-path">${p.clubs.map((c) => `<span class="seo-club">${esc(c)}</span>`).join('<span class="seo-arrow">→</span>')}</div>
<details class="seo-reveal"><summary>Reveal the player</summary><p><strong>${esc(p.answerName)}</strong></p></details></div>`,
    )
    .join("\n");
}

function gridSample(ctx) {
  const g = ctx.sampleGrid;
  if (!g) return "";
  const head = `<div class="x"></div>${g.cols.map((c) => `<div class="h">${esc(c)}</div>`).join("")}`;
  const rows = g.rows
    .map((r, ri) => `<div class="h">${esc(r)}</div>${g.cols.map((_, ci) => `<div>${ri * 3 + ci + 1}</div>`).join("")}`)
    .join("");
  const answers = g.cells
    .map((cell) => `<li><strong>${cell.n}. ${esc(cell.row)} × ${esc(cell.col)}:</strong> ${esc(cell.players.join(", "))}</li>`)
    .join("");
  return `<div class="seo-grid3" role="img" aria-label="Example football grid: rows ${esc(g.rows.join(", "))}; columns ${esc(g.cols.join(", "))}">${head}${rows}</div>
<details class="seo-reveal"><summary>Show possible answers for every cell</summary><ol style="list-style:none;margin-left:0">${answers}</ol></details>`;
}

export function buildGamePages(ctx) {
  const archiveLinks = ctx.recentQuizDays.slice(0, 7).map((d) => ({
    href: `/football-quiz/${d.date}/`,
    label: `Football quiz — ${d.label}`,
    note: `${d.questions.length} questions with answers`,
  }));
  const pairLinks = ctx.topPairPages.slice(0, 12).map((p) => ({ href: p.path, label: p.linkLabel, note: p.note }));
  const careerSetLinks = ctx.careerSets.slice(0, 9).map((s) => ({ href: s.path, label: s.linkLabel, note: s.note }));

  const pages = [];

  // ── Daily quiz ────────────────────────────────────────────────────────────
  pages.push(
    gamePage({
      slug: "daily-football-quiz",
      name: "Daily Football Quiz",
      title: "Daily Football Quiz — 10 New Questions Every Day | VerveQ",
      description:
        "A free daily football quiz that resets at midnight UTC. Ten questions, the same for everyone, one attempt per day. Build a streak, share your score.",
      ogTitle: "Daily Football Quiz — can you beat today's 10?",
      ogDescription: "Ten football questions, the same for everyone, once a day. One attempt — no retries. New quiz at midnight UTC.",
      body: `<div class="seo-hero"><span class="seo-tag">New quiz at midnight UTC</span>
<h1>Daily Football Quiz</h1>
<p class="seo-lede">Every day VerveQ serves <strong>ten football questions, the same ten for every player in the world</strong>. You get one attempt. Answer fast for bonus points, then share your score and find out who in your group chat actually knows their football.</p>
${cta("/v2/daily?ref=seo_daily", "Play today's quiz — free")}
<p class="seo-note">No download, no sign-up. Runs in your browser on phone or desktop.</p></div>
<h2>How the daily quiz works</h2>
<ul>
<li><strong>10 questions, one attempt a day.</strong> No retries: the score you get is the score you share.</li>
<li><strong>Same questions for everyone.</strong> Your 8/10 and your mate's 6/10 are directly comparable.</li>
<li><strong>Speed matters.</strong> Each question is worth up to 100 points, decaying the longer you think.</li>
<li><strong>Streaks.</strong> Finish the daily to keep your streak alive; miss a day and it resets.</li>
<li><strong>Resets at midnight UTC.</strong> That is 1am in the UK and 8pm in New York during summer time.</li>
</ul>
<h2>What the questions cover</h2>
<p>The daily draws from VerveQ's fact-checked football question bank: the Premier League, La Liga, Serie A, the Bundesliga and Ligue 1, the Champions League, the World Cup and Euros, record-breakers, transfers, managers and the odd bit of kit trivia. Every day mixes easier openers with a couple of questions that only the obsessives get right, so a perfect 10/10 is genuinely rare.</p>
<h2>Why only one attempt?</h2>
<p>Because that is what makes the score mean something. Anyone can get 10/10 with retries. The daily quiz is a level playing field: same questions, same clock, one shot. That is why players share their results. A score you cannot grind is a score worth bragging about.</p>
${archiveLinks.length ? `<h2>Missed a day? Previous quizzes with answers</h2>
<p>Every finished daily quiz is published in the <a href="/football-quiz/">football quiz archive</a> with all ten answers and explanations, so you can check the ones you got wrong or run them at the pub.</p>
${linkGrid(archiveLinks)}` : ""}
${moreGames("daily-football-quiz")}`,
      faqs: [
        { q: "When does the daily football quiz reset?", a: "A new quiz goes live every day at midnight UTC. Everyone in the world gets the same ten questions until the next reset." },
        { q: "Is the daily football quiz free?", a: "Yes. It is completely free and runs in your browser. You can play without creating an account." },
        { q: "Can I play yesterday's quiz?", a: 'You can read every previous quiz, with answers and explanations, in the <a href="/football-quiz/">football quiz archive</a>. Only today\'s quiz is scored.' },
        { q: "How is the daily quiz scored?", a: "Each correct answer is worth up to 100 points, and the points decay the longer you take, so fast correct answers score best. Wrong answers score zero." },
        { q: "Why can't I retry the daily quiz?", a: "One attempt keeps the scores comparable. Everyone faces the same ten questions under the same clock, so your score means the same thing as your friends' scores." },
      ],
    }),
  );

  // ── Grid ──────────────────────────────────────────────────────────────────
  pages.push(
    gamePage({
      slug: "football-grid",
      name: "Football Grid",
      title: "Football Grid Game — Free 3×3 Football Tic Tac Toe | VerveQ",
      description:
        "Free football grid game: name a player who fits both the row and the column (club, country or position). Nine cells, nine guesses, new boards anytime.",
      ogTitle: "Football Grid — nine cells, nine guesses",
      ogDescription: "Find the player who fits both club and country. The 3×3 football puzzle, free in your browser.",
      body: `<div class="seo-hero"><span class="seo-tag">3×3 challenge</span>
<h1>Football Grid Game</h1>
<p class="seo-lede">Three rows, three columns, nine intersections. <strong>Each cell needs a player who fits both headers</strong>: played for the club AND holds the nationality, or fits the position. You get nine guesses for nine cells, and no player can be used twice.</p>
${cta("/v2/verve-grid?ref=seo_grid", "Play the grid — free")}
<p class="seo-note">Easy, medium and hard boards. A fresh board every time you play, no waiting for tomorrow.</p></div>
<h2>How to play the football grid</h2>
<ol>
<li><strong>Read the headers.</strong> Rows and columns are clubs, countries or positions.</li>
<li><strong>Pick a cell and type a player.</strong> He must match both his row and his column, for example a Brazilian who played for Barcelona.</li>
<li><strong>Nine guesses in total.</strong> A wrong guess burns one without filling the cell.</li>
<li><strong>No reuse.</strong> Each player can fill only one cell, so save the well-travelled ones for the hard corners.</li>
</ol>
<h2>Try an example grid</h2>
<p>Here is a practice board built from VerveQ's player database. Rows are clubs, columns are nationalities. Can you fill all nine before you peek?</p>
${gridSample(ctx)}
<p>Stuck on a club pair? Our <a href="/who-played-for/">who played for both clubs</a> pages list the players who fit the most common grid intersections.</p>
<h2>Football grid strategy</h2>
<p>Scan for the hardest intersection first, usually the obscure club × small nation cell, and spend your thinking there while your guesses are intact. The easy cells will still be easy at guess nine; the hard cell won't feel easier with three guesses left.</p>
<p>Journeymen are gold. Players who spent two seasons at five clubs unlock more cells than one-club legends.</p>
${pairLinks.length ? `<h2>Popular grid answers: who played for both?</h2>${linkGrid(pairLinks)}` : ""}
${moreGames("football-grid")}`,
      faqs: [
        { q: "What is a football grid game?", a: "A 3×3 puzzle where each row and column is a club, country or position. You fill each cell with a real footballer who matches both headers, like a Frenchman who played for Arsenal." },
        { q: "Is it like Immaculate Grid or Tiki-Taka-Toe?", a: "Same idea: a football tic-tac-toe grid of club and country intersections. VerveQ's grid is solo, free and unlimited, with easy, medium and hard boards." },
        { q: "Can I play more than one football grid a day?", a: "Yes. A new board is dealt each time you play, so it is effectively unlimited." },
        { q: "Where can I find football grid answers?", a: 'Our <a href="/who-played-for/">who played for both clubs</a> pages list verified players for the most common club and country intersections.' },
      ],
    }),
  );

  // ── Career path ───────────────────────────────────────────────────────────
  pages.push(
    gamePage({
      slug: "career-path",
      name: "Career Path — Guess the Footballer",
      title: "Guess the Footballer by Career Path — Free Quiz | VerveQ",
      description:
        "Free career path football quiz: read a player's clubs in order and guess who he is. Three guesses, typo-friendly, 1,300+ fact-checked careers.",
      ogTitle: "Career Path — guess the player from his clubs",
      ogDescription: "Read the clubs, name the player. The football career path quiz, free in your browser.",
      genre: ["Trivia", "Sports", "Guessing game"],
      body: `<div class="seo-hero"><span class="seo-tag">Most played on VerveQ</span>
<h1>Guess the Footballer by Career Path</h1>
<p class="seo-lede">A chronological list of clubs. You name the player who lived that career. Some paths are one-club giveaways; some are journeyman epics that separate the fans from the encyclopedias. It is the most played game on VerveQ.</p>
${cta("/v2/career-path?ref=seo_career", "Play Career Path — free")}
<p class="seo-note">No sign-up. Choose one-at-a-time with no clock, or the 10 Path Challenge: ten careers, 30 seconds each.</p></div>
<h2>Try three career paths now</h2>
${careerPathSample(ctx)}
<h2>How it works</h2>
<ul>
<li><strong>The whole path is shown up front.</strong> No drip-feed: read it, think, type.</li>
<li><strong>Three guesses per player.</strong> Each miss lowers the points still on the table.</li>
<li><strong>Typos are forgiven.</strong> There is no autocomplete, but the matching absorbs spelling slips: "Lewandowsky" still counts.</li>
<li><strong>Close calls cost less.</strong> Almost-right answers are flagged as near misses instead of burning a full guess.</li>
<li><strong>Two ways to play.</strong> One at a time with no timer, or the 10 Path Challenge where the careers get harder and you have 30 seconds each.</li>
</ul>
<h2>Why no autocomplete?</h2>
<p>Because autocomplete turns a recall game into a recognition game. Scrolling a dropdown until a name looks familiar isn't knowing football. On VerveQ you type the name you remember, and the fuzzy matching handles the spelling, not the remembering.</p>
${careerSetLinks.length ? `<h2>Career path quizzes by club</h2><p>Ten career paths per quiz, answers hidden until you reveal them. Browse all of them in the <a href="/career-path-quiz/">career path quiz</a> section.</p>${linkGrid(careerSetLinks)}` : ""}
${moreGames("career-path")}`,
      faqs: [
        { q: "What is a football career path quiz?", a: "You see the clubs a footballer played for, in order, and you have to name the player. It is also called guess the footballer by transfers or by career." },
        { q: "How many career paths are there?", a: "VerveQ has more than 1,300 fact-checked career paths, from Ballon d'Or winners to cult-hero journeymen, with current transfers included." },
        { q: "Do I need to spell the name perfectly?", a: "No. The answer check forgives typos and flags near misses, but there is no autocomplete. You have to remember the player yourself." },
        { q: "Is the career path game free?", a: "Yes. Career Path is free and playable instantly in your browser with no account." },
        { q: "Can I practise career paths with answers?", a: 'Yes. The <a href="/career-path-quiz/">career path quiz</a> section has sets of ten paths by club and difficulty, with answers you can reveal.' },
      ],
    }),
  );

  // ── Higher or lower ───────────────────────────────────────────────────────
  pages.push(
    gamePage({
      slug: "higher-or-lower",
      name: "Higher or Lower Football",
      title: "Higher or Lower Football — Stats Streak Game | VerveQ",
      description:
        "Free football higher or lower game: is the next team's or player's stat higher or lower? Real league stats by season. One wrong call ends your streak.",
      ogTitle: "Higher or Lower: Football — how long is your streak?",
      ogDescription: "Real football stats, one call at a time. One wrong answer ends the run.",
      body: `<div class="seo-hero"><span class="seo-tag">Streak game</span>
<h1>Higher or Lower: Football</h1>
<p class="seo-lede">One stat is revealed, the next is hidden. Higher or lower? Get it right and the streak grows; get it wrong and the run is over, with no lives and no second chances. It is the purest one-more-go game in football.</p>
${cta("/v2/higher-lower?ref=seo_hol", "Play Higher or Lower — free")}
<p class="seo-note">Easy, medium and hard tiers. Free in your browser, no sign-up.</p></div>
<h2>How it works</h2>
<ul>
<li><strong>Real stats from real seasons.</strong> Goals scored, goals conceded, points, appearances and more, league by league and season by season, for example Premier League 2013/14 goals conceded.</li>
<li><strong>Chain to survive.</strong> Every correct call makes the revealed side your new baseline.</li>
<li><strong>One wrong ends it.</strong> Your final streak is your score.</li>
<li><strong>Difficulty tiers.</strong> Easy keeps the gaps wide; hard deals the coin-flip comparisons.</li>
</ul>
<h2>The trap that ends most streaks</h2>
<p>Recency bias. Players remember the last two seasons vividly and forget that a mid-table side from ten years ago conceded more than you think. When the stat is a season total, check the context line (league, season, stat) before you trust your gut.</p>
<h2>Higher or lower tips</h2>
<ul>
<li>Title winners rarely concede more than 40 league goals in a 38-game season; relegated sides often let in 60 or more.</li>
<li>Promoted teams usually sit in the bottom half for goals scored.</li>
<li>If two values feel identical, the one from the higher-scoring era is usually higher.</li>
</ul>
${moreGames("higher-or-lower")}`,
      faqs: [
        { q: "How do you play higher or lower football?", a: "You see a stat for one team or player and guess whether the next one's stat is higher or lower. Each correct guess extends your streak; one wrong guess ends the run." },
        { q: "What stats are used?", a: "Real league statistics by season, such as goals scored, goals conceded and points, across the top European leagues." },
        { q: "Is there a time limit?", a: "No clock, but switching tabs ends your run, so play it in one sitting." },
        { q: "Is it free?", a: "Yes, completely free and playable in your browser without an account." },
      ],
    }),
  );

  // ── Survival (initials) ───────────────────────────────────────────────────
  const initialsExamples = ctx.initialsExamples
    .map((e) => `<li><strong>${esc(e.initials)}</strong>: ${esc(e.players.join(", "))} and ${e.more.toLocaleString("en")} more</li>`)
    .join("");
  pages.push(
    gamePage({
      slug: "football-survival",
      name: "Footballer Initials Quiz (Survival)",
      title: "Footballer Initials Quiz — Name the Player | VerveQ",
      description:
        "Free footballer initials quiz: we show two initials, you name any player who fits. 30,000+ valid players, three lives, rounds get harder as you survive.",
      ogTitle: "Footballer initials quiz — how long can you survive?",
      ogDescription: "Two initials. Name any footballer who fits. Three lives. Free in your browser.",
      body: `<div class="seo-hero"><span class="seo-tag">Survival mode</span>
<h1>Footballer Initials Quiz</h1>
<p class="seo-lede">The rules fit in one sentence: <strong>we show you two initials, you name any footballer with those initials</strong>. "TH"? Thierry Henry works. So does any other professional with those initials. Keep answering, keep surviving.</p>
${cta("/v2/daily-survival?ref=seo_survival", "Play today's survival run")}
<p class="seo-note">Today's run is the same for everyone: one attempt, free, no sign-up.</p></div>
<h2>How it works</h2>
<ul>
<li><strong>Two initials per round.</strong> Any professional footballer who matches counts: more than 30,000 players are valid answers.</li>
<li><strong>Three lives.</strong> A wrong guess costs one. Typos don't: close-enough spelling counts, and a unique surname is enough.</li>
<li><strong>It gets harder.</strong> Early rounds want famous names; deep rounds reward the fan who knows the Ligue 1 back four.</li>
<li><strong>Help costs points.</strong> Ask for clues, then letters, but every reveal shrinks that round's pot.</li>
</ul>
<h2>Initials with the most answers</h2>
<p>Some combinations are easy money. From VerveQ's database:</p>
<ul>${initialsExamples}</ul>
<h2>Tips from the leaderboard</h2>
<ul>
<li>Think surnames first: a surname is usually enough to recall the rest.</li>
<li>Build a mental bank for common combos like JM, DS and AM, which have hundreds of valid answers.</li>
<li>Don't burn help early. The pot pays most when you answer clean.</li>
</ul>
${moreGames("football-survival")}`,
      faqs: [
        { q: "How does the footballer initials quiz work?", a: "Each round shows two initials, and you name any professional footballer whose first name and surname start with them. Wrong answers cost a life; you have three." },
        { q: "Does any player count?", a: "Yes. There is no single correct answer: more than 30,000 players in the database are accepted." },
        { q: "What if I misspell the name?", a: "Close spellings are accepted, and a surname alone is enough when it is unique." },
        { q: "Is it free?", a: "Yes. The daily survival run is free, and you can play it without an account." },
      ],
    }),
  );

  // ── Blitz ─────────────────────────────────────────────────────────────────
  pages.push(
    gamePage({
      slug: "60-second-football-quiz",
      name: "60-Second Football Quiz (Blitz)",
      title: "60-Second Football Quiz — Beat the Clock | VerveQ",
      description:
        "A free 60-second football quiz: answer as many multiple-choice football questions as you can before the clock hits zero. Wrong answers cost 3 seconds.",
      ogTitle: "60 seconds. How many football questions can you answer?",
      ogDescription: "The timed football quiz: one minute on the clock, wrong answers cost three seconds.",
      body: `<div class="seo-hero"><span class="seo-tag">Timed quiz</span>
<h1>60-Second Football Quiz</h1>
<p class="seo-lede">One minute on the clock. <strong>Answer as many football questions as you can before it hits zero.</strong> Every right answer adds to your score; every wrong one takes three seconds off the clock. No lifelines, no pauses.</p>
${cta("/v2/blitz?ref=seo_blitz", "Start the 60-second quiz")}
<p class="seo-note">Free, instant, no sign-up.</p></div>
<h2>How Blitz works</h2>
<ul>
<li><strong>60 seconds total.</strong> The clock starts on the first question.</li>
<li><strong>Multiple choice.</strong> Four options per question, tap to answer.</li>
<li><strong>Wrong answers cost 3 seconds.</strong> Guessing blindly is a losing strategy.</li>
<li><strong>Stay on the tab.</strong> Switching away counts as a wrong answer.</li>
</ul>
<h2>How to score higher</h2>
<p>Speed beats certainty only up to a point. If you are torn between two options, a quick 50/50 guess costs less time than a long think, but a wild guess on a question you have no idea about costs three seconds you could have spent on the next one. Most top scores come from a steady rhythm of about two seconds per question.</p>
${moreGames("60-second-football-quiz")}`,
      faqs: [
        { q: "How long is the quiz?", a: "Exactly 60 seconds. Answer as many questions as you can before time runs out." },
        { q: "What happens if I get one wrong?", a: "A wrong answer takes 3 seconds off the clock, so blind guessing hurts your score." },
        { q: "What kind of questions are there?", a: "Multiple-choice football trivia at intermediate difficulty: leagues, players, clubs, records and tournaments." },
      ],
    }),
  );

  // ── Duels ─────────────────────────────────────────────────────────────────
  pages.push(
    gamePage({
      slug: "football-duels",
      name: "Football Quiz Duels",
      title: "Football Quiz With Friends — 1v1 Duels Online | VerveQ",
      description:
        "Play a football quiz with friends online: send a duel link, both answer the same questions, the result card settles it. Free, no account needed.",
      ogTitle: "Football quiz duels — settle it with a link",
      ogDescription: "Both answer the same football questions. The result card does the talking.",
      genre: ["Trivia", "Sports", "Multiplayer"],
      body: `<div class="seo-hero"><span class="seo-tag">Multiplayer</span>
<h1>Football Quiz With Friends</h1>
<p class="seo-lede">Every group chat has one: the mate who is sure he knows more football than you. Duels settle it. Pick a topic and difficulty, send the link, and you both face <strong>the exact same questions on the exact same clock</strong>. The result card does the talking.</p>
${cta("/v2/duels?ref=seo_duels", "Start a duel — free")}
<p class="seo-note">Want a whole group at once? Arena rooms let everyone answer live together.</p></div>
<h2>How football duels work</h2>
<ul>
<li><strong>Async, not appointment TV.</strong> You play now; they play when they open the link.</li>
<li><strong>Same questions, seeded per duel.</strong> Nobody gets the easy set.</li>
<li><strong>No account needed to accept.</strong> Your mate taps the link and plays straight away.</li>
<li><strong>A rivalry ledger.</strong> Every duel updates your head-to-head record: wins, losses, streaks.</li>
<li><strong>Share cards that unfurl.</strong> Invites preview with a taunt card in WhatsApp and iMessage, not a bare link.</li>
</ul>
<h2>Playing with a group</h2>
<p>For more than two players, create an <strong>Arena</strong> room: share the code, everyone answers the same questions at the same time, and the scoreboard updates live. It works well for five-a-side teams, pub quiz warm-ups and work group chats.</p>
${moreGames("football-duels")}`,
      faqs: [
        { q: "How can I play a football quiz with friends online?", a: "Start a duel on VerveQ and send the link. You both answer the same football questions, and the result card shows who won." },
        { q: "Does my friend need an account?", a: "No. Whoever opens the link can play straight away as a guest." },
        { q: "Can more than two people play?", a: "Yes. Arena rooms let a whole group answer the same questions live using a room code." },
        { q: "Is it free?", a: "Yes, duels and arena rooms are free." },
      ],
    }),
  );

  // ── Hub ───────────────────────────────────────────────────────────────────
  const hubCrumbs = [HOME_CRUMB, GAMES_CRUMB];
  const hubFaqs = [
    { q: "Are VerveQ's football games free?", a: "Yes. Every game is free to play in your browser, and most need no account at all." },
    { q: "Which football game should I start with?", a: 'Career Path is the most played: you see a player\'s clubs and name him. If you want one quick daily habit, play the <a href="/games/daily-football-quiz/">daily football quiz</a>.' },
    { q: "Do the games work on mobile?", a: "Yes. Every game is built for phones first and also works on desktop." },
  ];
  pages.push({
    path: "/games/",
    title: "Free Football Quiz Games Online — Play in Browser | VerveQ",
    description:
      "Free football games in your browser: daily football quiz, guess the footballer by career path, football grid, higher or lower, initials quiz and 1v1 duels.",
    ogTitle: "Free football games — pick one and play",
    ogDescription: "Daily quiz, career path, football grid, higher or lower and duels. Free, no download.",
    breadcrumbs: hubCrumbs,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Free football games on VerveQ",
        itemListElement: MORE_GAMES.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${ORIGIN}${g.href}`, name: g.label })),
      },
      breadcrumbLd(hubCrumbs),
      faqLd(hubFaqs),
    ],
    body: `<div class="seo-hero"><span class="seo-tag">Free · no download</span>
<h1>Free Football Games</h1>
<p class="seo-lede">Seven football games you can play right now in your browser, built for people who actually watch the matches. Pick one and play: no download, and most need no account.</p>
${cta("/v2/career-path?ref=seo_games", "Play the most popular game")}</div>
<h2>All games</h2>
${linkGrid(MORE_GAMES)}
<h2>Football quizzes and answers</h2>
${linkGrid([
  { href: "/football-quiz/", label: "Football quiz questions and answers", note: "Every past daily quiz, with explanations" },
  { href: "/career-path-quiz/", label: "Career path quizzes", note: "Ten players per quiz, by club and difficulty" },
  { href: "/who-played-for/", label: "Who played for both clubs?", note: "Football grid answers by club pair" },
])}
${faqSection(hubFaqs)}`,
  });

  return pages;
}

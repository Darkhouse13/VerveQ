/**
 * The homepage's server-rendered block. It sits BELOW the React cold-entry
 * landing (which keeps its own hero and H1), so crawlers and scrolling humans
 * get real text and real links into every game and content section.
 */
import { faqLd, faqSection, linkGrid, ORIGIN } from "../lib.mjs";

export function buildHome(ctx) {
  const faqs = [
    { q: "Is VerveQ free?", a: "Yes. Every game is free to play in your browser, and you can start without an account." },
    { q: "What football games can I play?", a: 'A <a href="/games/daily-football-quiz/">daily football quiz</a>, <a href="/games/career-path/">guess the footballer by career path</a>, a <a href="/games/football-grid/">football grid</a>, <a href="/games/higher-or-lower/">higher or lower</a>, a <a href="/games/football-survival/">footballer initials quiz</a>, a <a href="/games/60-second-football-quiz/">60-second quiz</a> and <a href="/games/football-duels/">1v1 duels with friends</a>.' },
    { q: "Do I need to download an app?", a: "No. VerveQ runs in the browser on any phone or computer. You can add it to your home screen if you want it one tap away." },
  ];
  const latest = ctx.recentQuizDays[0];
  return {
    path: "/",
    // The React landing above already carries the brand; a second header would stack.
    hideHeader: true,
    title: "Football Trivia & Quiz Games — Play Free | VerveQ",
    description:
      "Free football quiz games: a daily quiz, guess the footballer by career path, a football grid, higher or lower and 1v1 duels. No sign-up needed.",
    ogTitle: "VerveQ — Settle it",
    ogDescription: "Prove you know more than your mates — head-to-head football trivia. Play free, no sign-up.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "VerveQ",
        url: `${ORIGIN}/`,
        inLanguage: "en",
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "VerveQ",
        url: `${ORIGIN}/`,
        logo: `${ORIGIN}/pwa-512x512.png`,
        sameAs: ["https://www.instagram.com/playverveq/"],
      },
      faqLd(faqs),
    ],
    // #root is empty until the bundle runs; hold a screen for the landing so
    // this block doesn't paint first and then jump down (layout shift).
    extraHead: `<style>#root:empty{min-height:100vh}</style>`,
    body: `<h2>Free football quiz games</h2>
<p class="seo-lede">VerveQ is a set of free football trivia games for people who actually watch the matches. Name the player from his career path, fill a 3×3 football grid, call higher or lower on real league stats, and take the same ten-question daily quiz as everyone else in the world. No download, and no account needed to start.</p>
${linkGrid([
  { href: "/games/career-path/", label: "Guess the footballer", note: "Name the player from his clubs, the most played game" },
  { href: "/games/daily-football-quiz/", label: "Daily football quiz", note: "10 questions, same for everyone, once a day" },
  { href: "/games/football-grid/", label: "Football grid", note: "Club × country tic-tac-toe" },
  { href: "/games/higher-or-lower/", label: "Higher or lower", note: "Real league stats, one wrong call ends it" },
  { href: "/games/football-survival/", label: "Footballer initials quiz", note: "Two initials, name any player" },
  { href: "/games/60-second-football-quiz/", label: "60-second football quiz", note: "Beat the clock" },
  { href: "/games/football-duels/", label: "Football quiz with friends", note: "Send a link, settle it 1v1" },
])}
<h2>Football quiz questions and answers</h2>
<p>Every daily quiz is published with its answers once it closes${latest ? `. The latest is the <a href="/football-quiz/${latest.date}/">${latest.label} quiz</a>` : ""}. Browse by topic:</p>
${linkGrid(ctx.topicPages.slice(0, 9).map((t) => ({ href: t.page.path, label: `${t.topic.name} quiz`, note: `${t.count} questions with answers` })))}
<h2>Football grid answers</h2>
<p>Who played for both clubs? Verified players for the most common grid cells.</p>
${linkGrid(ctx.topPairPages.slice(0, 9).map((p) => ({ href: p.path, label: p.linkLabel, note: p.note })))}
<p><a href="/who-played-for/">All grid answers →</a> · <a href="/career-path-quiz/">Career path quizzes by club →</a></p>
${faqSection(faqs)}`,
  };
}

/**
 * /about/ — who VerveQ is and how its football facts are sourced and checked.
 * Every claim here mirrors docs/CIE_SOURCING_POLICY.md and the data the pages
 * are built from; don't add claims the pipeline doesn't back.
 */
import { breadcrumbLd, cta, ORIGIN } from "../lib.mjs";

export function buildAbout(ctx) {
  const crumbs = [{ name: "VerveQ", path: "/" }, { name: "About", path: "/about/" }];
  return {
    path: "/about/",
    title: "About VerveQ — How We Source and Check Football Facts",
    description:
      "VerveQ makes free football quiz games. How our questions and player data are sourced (Wikidata, cited per fact), checked before release and corrected.",
    breadcrumbs: crumbs,
    jsonLd: [
      breadcrumbLd(crumbs),
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About VerveQ",
        url: `${ORIGIN}/about/`,
        about: {
          "@type": "Organization",
          name: "VerveQ",
          url: `${ORIGIN}/`,
          logo: `${ORIGIN}/pwa-512x512.png`,
          sameAs: ["https://www.instagram.com/playverveq/"],
        },
      },
    ],
    body: `<div class="seo-hero"><span class="seo-tag">About</span>
<h1>About VerveQ</h1>
<p class="seo-lede">VerveQ is an independent football trivia site. We make free browser games (a daily quiz, career paths, a football grid, higher or lower, duels) for people who actually watch the matches, in English, French and Spanish.</p>
${cta("/v2/career-path?ref=seo_about", "Play the most popular game")}</div>
<h2>Where our football facts come from</h2>
<p>A trivia game is only as good as its answers, so every fact has to come from a source we can cite and re-check. Our player data (clubs and the years a player spent at each, nationality, position, date of birth) comes from <a href="https://www.wikidata.org/">Wikidata</a>, the open, CC0-licensed knowledge base. Each fact is stored with the Wikidata item and property it came from and the date it was retrieved.</p>
<p>Facts are graded. Only facts confirmed at the highest confidence are used on reference pages such as <a href="/who-played-for/">who played for both clubs</a>. Uncertain facts are held back until they are confirmed or corrected by hand.</p>
<h2>How questions are written and checked</h2>
<ul>
<li><strong>Original wording.</strong> We source facts, never other people's prose: every question is written from scratch.</li>
<li><strong>Checked against the source.</strong> New questions are verified against the cited source before release, not against anyone's memory. Questions that fail the check don't ship.</li>
<li><strong>Frozen when served.</strong> The daily quiz stores the exact questions and answers everyone played that day, which is what the <a href="/football-quiz/">quiz archive</a> publishes once the day is over.</li>
<li><strong>Recent transfers included.</strong> Career paths are fact-checked and include recent moves.</li>
</ul>
<h2>How the games work</h2>
<p>Every game runs in your browser with no download, and most need no account. Scores are checked on our servers, not in your browser, so leaderboards and duel results can't be edited. The daily quiz and daily survival run are the same for every player in the world.</p>
<h2>Found a mistake?</h2>
<p>Football changes fast and sources can be wrong. If you spot an error in a question, a career path or a grid answer, send us a message on <a href="https://www.instagram.com/playverveq/">Instagram</a> and we will check it against the source and correct it.</p>
<h2>Data credits</h2>
<p>Player and club facts: <a href="https://www.wikidata.org/">Wikidata</a> (CC0 1.0). Club and competition names are used only to identify them in a quiz context.</p>`,
  };
}

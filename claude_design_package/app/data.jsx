/* global React */
const { useState, useEffect, useRef } = React;

/* ============================================================
   STATIC DATA — no backend, all illustrative
   ============================================================ */

const CATEGORIES = [
  { id: 'sport',   label: 'Sport',          icon: '◆', tint: 'var(--orange)', live: true,  count: '11 modes' },
  { id: 'music',   label: 'Music',          icon: '♪', tint: 'var(--pink)',   live: false, count: 'Coming soon' },
  { id: 'film',    label: 'Film & TV',      icon: '▶', tint: 'var(--blue)',   live: false, count: 'Coming soon' },
  { id: 'history', label: 'History',        icon: '⌂', tint: 'var(--yellow)', live: false, count: 'Coming soon' },
  { id: 'geo',     label: 'Geography',      icon: '◉', tint: 'var(--lime)',   live: false, count: 'Coming soon' },
  { id: 'science', label: 'Science',        icon: '✦', tint: 'var(--blue)',   live: false, count: 'Coming soon' },
];

const SPORTS = [
  { id: 'football', label: 'Football',   icon: '⚽', live: true,  note: 'Fully built out' },
  { id: 'basket',   label: 'Basketball', icon: '🏀', live: false, note: 'Coming soon' },
  { id: 'tennis',   label: 'Tennis',     icon: '🎾', live: false, note: 'Coming soon' },
  { id: 'f1',       label: 'Motorsport', icon: '🏁', live: false, note: 'Coming soon' },
];

/* Football mode grid. football-only modes flagged. */
const FOOTBALL_MODES = [
  { id: 'quiz',     name: 'Quiz',          tag: 'Classic',     tint: 'var(--blue)',   icon: '?',  desc: '10 questions, climb the ladder.', span: 1 },
  { id: 'survival', name: 'Survival',      tag: 'Daily hook',  tint: 'var(--orange)', icon: '♥',  desc: 'One life. How far can you go?', span: 1 },
  { id: 'blitz',    name: 'Blitz',         tag: '60s',         tint: 'var(--pink)',   icon: '⚡', desc: 'Sixty seconds, max answers.', span: 1 },
  { id: 'daily',    name: 'Daily Challenge', tag: 'Resets 24h', tint: 'var(--yellow)', icon: '★', desc: "Everyone gets today's set.", span: 1, daily: true },
  { id: 'higher',   name: 'Higher or Lower', tag: 'Football only', tint: 'var(--orange)', icon: '↕', desc: 'Transfer fees, apps, goals — call it.', span: 1, only: true },
  { id: 'grid',     name: 'VerveGrid',     tag: 'Football only', tint: 'var(--blue)',   icon: '▦', desc: '3×3 player connections.', span: 1, only: true },
  { id: 'whoami',   name: 'Who Am I?',     tag: 'Football only', tint: 'var(--pink)',   icon: '◐', desc: 'Clues drop. Guess the player.', span: 1, only: true },
  { id: 'live',     name: 'Live Match',    tag: '1v1 realtime', tint: 'var(--ink)',    icon: '⚔', desc: 'Head-to-head, server clock.', span: 1, multi: true },
  { id: 'duels',    name: 'Duels',         tag: 'Async',       tint: 'var(--blue)',   icon: '⤬', desc: 'Challenge a rival on your time.', span: 1, multi: true, hasCats: true },
  { id: 'arena',    name: 'Challenge Arena', tag: 'Up to 8',  tint: 'var(--orange)', icon: '◈', desc: 'Live lobby battle royale of football knowledge.', span: 2, multi: true, hasCats: true, feature: true },
];

/* sub-categories that live INSIDE arena/duels (NOT standalone modes) */
const ARENA_CATEGORIES = [
  { id: 'wcf',  label: 'Which Came First', icon: '⇄', desc: 'Order two events in time.' },
  { id: 'know', label: 'Knowledge',        icon: '✓', desc: 'Straight trivia rounds.' },
  { id: 'mixed',label: 'Mixed Bag',        icon: '✶', desc: 'All formats, shuffled.' },
];

/* Arena roster — STATUS ONLY. never any answer content. */
const ARENA_ROSTER = [
  { id: 'you',  name: 'You',        score: 1840, status: 'thinking', streak: 4, you: true },
  { id: 'p2',   name: 'K. Mensah',  score: 2010, status: 'locked',   streak: 6 },
  { id: 'p3',   name: 'Rui_99',     score: 1720, status: 'answered', streak: 0 },
  { id: 'p4',   name: 'salah_szn',  score: 1660, status: 'thinking', streak: 2 },
  { id: 'p5',   name: 'M. Okafor',  score: 1490, status: 'locked',   streak: 1 },
  { id: 'p6',   name: 'tactico',    score: 1205, status: 'answered', streak: 0 },
];

/* Per-player reveal verdicts (only shown on reveal) */
const ARENA_REVEAL = [
  { id: 'p2',  name: 'K. Mensah', pick: 'A',  correct: true,  delta: '+120', ms: 2310 },
  { id: 'you', name: 'You',       pick: 'A',  correct: true,  delta: '+90',  ms: 3980, you: true },
  { id: 'p4',  name: 'salah_szn', pick: 'C',  correct: false, delta: '+0',   ms: 5120 },
  { id: 'p3',  name: 'Rui_99',    pick: 'B',  correct: false, delta: '+0',   ms: 1990 },
  { id: 'p5',  name: 'M. Okafor', pick: 'A',  correct: true,  delta: '+70',  ms: 6440 },
  { id: 'p6',  name: 'tactico',   pick: 'D',  correct: false, delta: '+0',   ms: 4870 },
];

/* ============================================================
   LEARN DATA — 4 question types, a mistake-branch, teaching reveal
   ============================================================ */

const LEARN_SUBJECTS = [
  { id: 'pl',    label: 'Premier League history', mastery: 0.82, due: 6,  state: 'locked',   tint: 'var(--lime)' },
  { id: 'tac',   label: 'Tactics & formations',   mastery: 0.54, due: 12, state: 'learning', tint: 'var(--orange)' },
  { id: 'wc',    label: 'World Cup lore',         mastery: 0.91, due: 2,  state: 'locked',   tint: 'var(--lime)' },
  { id: 'tr',    label: 'Transfer records',       mastery: 0.33, due: 18, state: 'learning', tint: 'var(--pink)' },
  { id: 'rules', label: 'Laws of the game',       mastery: 0.67, due: 4,  state: 'learning', tint: 'var(--orange)' },
];

/* Each Learn question is one of: mcq | text | numeric | order */
const LEARN_QUESTIONS = [
  {
    type: 'mcq',
    subject: 'Premier League history',
    prompt: 'A team finishes the season with the most points but a worse goal difference than the side level on points. What happens?',
    options: [
      { k: 'A', t: 'They win the league — points come first.' },
      { k: 'B', t: 'A title play-off match is held.' },
      { k: 'C', t: 'Goal difference decides — they finish 2nd.' },
      { k: 'D', t: 'The title is shared.' },
    ],
    correct: 'A',
    branchOn: 'C',
    teach: "Goal difference only matters when points are LEVEL. With more points you're champion outright — GD never enters the picture. The 'level on points' detail is the trap.",
    branchTeach: "Tempting — GD is famous for deciding 1989 and 2012. But those were teams LEVEL on points. Here one side has *more* points, so the tiebreaker never triggers.",
  },
  {
    type: 'text',
    subject: 'World Cup lore',
    prompt: 'Name the only nation to have played in every FIFA World Cup tournament.',
    accept: ['brazil'],
    correct: 'Brazil',
    teach: "Brazil is the constant — present at all 22 tournaments since 1930. A useful anchor: build other World Cup facts around 'who was missing', because Brazil never was.",
  },
  {
    type: 'numeric',
    subject: 'Laws of the game',
    prompt: 'How many players from one team must be on the pitch for a match to legally continue?',
    answer: 7,
    unit: 'players',
    tolerance: 0,
    correct: '7',
    teach: "Below 7 and the match is abandoned. The logic: a team is 11, and the laws tolerate losing up to 4 (red cards / injuries) before the contest is no longer valid.",
  },
  {
    type: 'order',
    subject: 'Premier League history',
    prompt: 'Drag these clubs into the order they FIRST won the Premier League (earliest at top).',
    items: [
      { id: 'mu', t: 'Manchester United', year: 1993 },
      { id: 'ars', t: 'Arsenal', year: 1998 },
      { id: 'che', t: 'Chelsea', year: 2005 },
      { id: 'mc', t: 'Manchester City', year: 2012 },
    ],
    teach: "Order tracks the eras: United owned the 90s, Arsenal's 'Invincibles' build began late-90s, Chelsea arrived with new ownership in '05, City's project peaked in 2012.",
  },
];

Object.assign(window, {
  CATEGORIES, SPORTS, FOOTBALL_MODES, ARENA_CATEGORIES,
  ARENA_ROSTER, ARENA_REVEAL, LEARN_SUBJECTS, LEARN_QUESTIONS,
});

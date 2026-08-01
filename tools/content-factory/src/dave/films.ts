// THE DAVE TAPES — the live-action lane.
//
// Every other video in this repo is drawn: Remotion is the artist. These are
// shot: Higgsfield (Seedance 2.0) is the camera and Remotion is only the
// cutting room. That split is the whole idea. AI video is good at the one
// thing vector motion design can never do — a human face being caught — and
// hopeless at the one thing this brand cannot compromise: the cream/ink
// lockup, frame-exact type, a logo that is the same logo every time. So
// neither is asked to do the other's job.
//
// The shape is fixed and it is the format:
//
//   [ AI footage — the hook, the joke, the face ]  →  [ SNAP — cream, ink, us ]
//
// The SNAP is a hard cut. No dissolve, no fade, nothing eased between the two
// worlds. The cut IS the punchline: reality is where Dave lives, the cream
// card is where the verdict arrives. It also means the footage never has to
// carry brand consistency and the card never has to carry the hook — motion
// design lost that argument in batch 1's retention data.
//
// WHY DAVE. He is not new. He has been here since batch 2 and he is in fifteen
// promos: the take ("He's not even top 10 all time. Sorry."), the group chat on
// day 6 of crisis, the man with zero evidence, 2/10 in `horror`, the one you
// lose to in `rematch`, and the fan licence DENIED — reason: vibes only. In
// every one of those he is a name in a box. He has never had a face, because
// until now nothing here could shoot one. This batch is not "some AI videos".
// It is a casting call six batches overdue.
//
// CANON IS LOAD-BEARING — do not invent Dave facts to fit a gag:
//   - the take:   "He's not even top 10 all time. Sorry."
//   - the score:  2/10                            (`horror`)
//   - the ruling: DENIED — reason: vibes only     (`license`)
//   - evidence:   none, ever                      (`breaking`)
// A film may dramatise any of these. A film may not contradict them.
//
// CASTING IS FIXED. `public/dave/dave-ref.png` is Dave, and every clip passes
// it to Seedance as an image reference so the same man walks through all four
// films and every future batch. Re-cast him and the archive stops being about
// one person. The reference is committed for the same reason the semi-final VO
// is committed: the character must not depend on a re-roll.
//
// THE LAW THAT DOES NOT BEND (README, "Rules"): no crests, no kits, no club
// marks — plus its live-action extension, which matters far more now that the
// pixels are photoreal: **no real players, ever, in any lane.** Higgsfield will
// reject a named footballer outright (`ip_detected`), but that is not why the
// rule exists. It exists because this brand does not put words in a real
// person's mouth. Everyone on screen here is a fan. The joke is always aimed at
// the man who *talks* about football, never at anyone who plays it — which is
// also, conveniently, the funnier target.
//
// English only; cream/ink/brand accents on the snap. Same as everywhere else.

export const FPS = 30;

// Everything after the footage runs 120 BPM — 15 frames a beat. It used to be
// six beats of cream and out; batch 2 of this lane made it an act. The first
// cut of these films banked the joke and flashed a logo, and the note that
// came back from cold viewers was "funny, but what IS this?" — the snap told
// them Dave failed without ever showing the thing he failed AT. So the cream
// world now carries three scenes instead of one card:
//
//   [ VERDICT — the ruling, on the cut ]        2s   the punchline, unchanged
//   [ DEMO — the app, played on screen ]        8s   a real round: question,
//                                                    countdown, Dave's answer
//                                                    tagged, the reveal
//   [ OUTRO — the turn, then the lockup ]     4.5s   now it's about you
//
// The demo is the answer to "what is this", and it's play-along — the viewer
// has 3 seconds to beat Dave in their head, which is 3 more seconds of
// retention the old card never asked for. The turn moves to AFTER the round on
// purpose: "SO WOULD YOU." lands very differently once you've just played.
export const BEAT = 15;

// Act-two grid, frames relative to the cut (footage end). One grid for all
// four films — the audio in promo/dave-audio.mjs mirrors these numbers, so a
// change here is a change there or the ticks drift off the countdown.
export const ACT2 = {
  verdict: 0, // hard cut to cream; the ruling slams in on the cut
  demo: 4 * BEAT, // whoosh → the app frame + header band
  question: 8 * BEAT, // question slams, options pop in
  count: 14 * BEAT, // 3… 2… 1…, 2 beats per count
  daveTag: 17 * BEAT, // mid-countdown, Dave's pick gets named
  reveal: 20 * BEAT, // correct stamps, Dave's answer buzzes out
  result: 23 * BEAT, // the score strip — DAVE 0/1 · YOU ?/1
  turn: 26 * BEAT, // it stops being about Dave and starts being about you
  lockup: 29 * BEAT, // VERVEQ + verveq.com
} as const;

// 35 beats — 17.5s of cream. With ~9s of footage the films land ~23–26s,
// which is semi-final territory, and earned the same way: more said, not
// slower saying.
export const SNAP = 35 * BEAT;

/**
 * A kept slice of the source clip, in **source seconds**.
 *
 * Seedance sets its own pace and it is not a TikTok pace: it opens on an
 * establishing beat, and it leaves long dead patches where nobody speaks. The
 * README's law is that the first three seconds decide everything, so the
 * establishing beat is the first thing to go — and where the middle sags, we
 * jump-cut it out. A jump cut inside a handheld documentary shot is invisible;
 * it is the native grammar of the form. Three seconds of a man saying nothing
 * is not.
 *
 * This is the part of the job the camera cannot do for you, and the reason
 * this lane still runs through Remotion instead of being posted raw.
 */
export type Seg = { from: number; to: number };

/**
 * A title card burned over the footage.
 *
 * NOT a subtitle. The distinction is deliberate and it is a correctness
 * matter, not a style one: the audio in these clips was generated, and while
 * you can measure exactly *when* Seedance speaks (`dave.mjs --envelope`), you
 * cannot verify the exact *words* it chose without listening. Captions that
 * claim to be a transcript would be asserting something unverified — so these
 * don't claim it. They are the film's own kinetic type, carrying the line that
 * matters, timed to land on the speech. If the delivery differs slightly from
 * the script, a title card still reads as emphasis. A wrong subtitle reads as
 * broken.
 *
 * It also happens to be what this library already speaks: twenty promos of
 * kinetic type, zero subtitles.
 *
 * `at` is in **source seconds** — the timeline you actually measured — and the
 * segment map converts it. Re-trim a film and the cards follow the words.
 *
 * READ THE LEVELS, NOT JUST THE GAPS. The envelope tells you *who* is speaking
 * as well as when, and `support-group` shipped wrong once because that got
 * skimmed: close-mic and loud is the person in front of the camera; a group at
 * the back of a room is quiet even when it's a dozen of them, and a unison
 * chorus is one swell up and down where a sentence has syllables. A loud burst
 * at the head is far more likely to be your subject's first line than it is
 * room tone — do not trim it off without checking. If two readings fit, crop
 * the mouth out of a frame (`-ss 0.2 … -vf crop=…`); it costs one command and
 * it settles it.
 */
export type Cue = {
  at: number;
  dur: number;
  text: string;
  /**
   * How hard the card hits, which is the only thing this actually controls:
   *
   *   `quiet` — cream on ink, mono, small. The room talking: a narrator, an
   *             examiner, an institution. Calm by construction.
   *   `loud`  — accent ground, display face, oversized. The line the film is
   *             built to deliver.
   *
   * This started life as `who: "vo" | "dave"` — the room versus the man — and
   * it was a nicer idea that survived exactly three films. In `warning` the
   * line that has to hit hardest ("Football ignorance.") is the *narrator's*,
   * so a speaker-named field would have had to lie to get the right type on
   * screen. Naming it after the emphasis instead keeps the styling honest: in
   * three films out of four the loud one happens to be Dave, and that's a fact
   * about Dave, not about the schema.
   */
  tone: "quiet" | "loud";
};

/**
 * Act two — one round of the real product, played on screen.
 *
 * This is the scene the cold viewer asked for. The footage sells the joke and
 * the verdict banks it, but neither ever says what VerveQ *is* — so the demo
 * shows it the only way that doesn't feel like an ad: a question appears, the
 * countdown runs, the viewer answers in their head, the board reveals. The
 * frame is styled as the app's Daily Quiz because that is a real thing the
 * viewer can go do today (10 MCQs, one attempt, streaks — see
 * app/src/pages/shell/play/DailyQuizPlayScreen.tsx), and the comedy never
 * stops: Dave's pick is tagged on the board before the reveal, and Dave is
 * wrong.
 *
 * THE QUESTIONS ARE LOAD-BEARING FACTS. Same law as the semi-final: a "did you
 * know" invites scrutiny, numbers get screenshot, so every question here must
 * survive the reply guy. All four were verified 2026-07-16 (Messi still 8
 * Ballons d'Or after Dembélé took 2025; Brazil out of the 2026 World Cup in
 * the R16, so "5" cannot change on July 19). Swap a question and you re-verify
 * it — "probably right" is not a standard this brand screenshots at.
 */
export type Demo = {
  /** ink sticker-band over the demo — the film's voice carrying into the app */
  header: string;
  /** progress chip inside the frame, e.g. "Q7/10" — the Daily Quiz is 10 Qs */
  qLabel: string;
  question: string;
  /** exactly four; displayed in this order */
  options: [string, string, string, string];
  correct: number;
  /** the one Dave picked. Wrong by definition — canon does not bend. */
  dave: number;
  /** the sticker naming Dave's pick — per-film voice, e.g. "THE SPECIMEN" */
  daveTag: string;
  /** the line over the revealed board. Present tense, full stop, no "!". */
  result: string;
};

export type Film = {
  /** slug — public/dave/<name>.mp4 in, out/<date>/dave-<name>.mp4 out */
  name: string;
  /** the genre being hijacked, for the render log and the caption file */
  angle: string;
  /** kept slices of the source, in order. Everything else is cut. */
  segments: Seg[];
  /** which brand accent leads the snap — one per film, no two alike */
  accent: "orange" | "pink" | "blue" | "lime" | "red";
  /**
   * Burned on frame 0 over the footage, so the film is legible before a word
   * is spoken. This is the hybrid's whole payoff: Seedance supplies a striking
   * image, we supply the sentence that makes it land instantly. A polygraph
   * needle in macro is arresting but not *nameable*, and an image nobody can
   * name is an image nobody stays for.
   */
  hook: string;
  cues: Cue[];
  /** the ruling on Dave. Present tense, full stop, never an exclamation mark. */
  verdict: string;
  /** act two — the round the viewer plays. See the Demo docs above. */
  demo: Demo;
  /** the pivot — where the camera turns around onto the viewer. After the
   *  demo, not before it: "SO WOULD YOU." is a taunt when you've just watched,
   *  and a verdict when you've just played. */
  turn: string;
  /** tagline under the lockup, pulled from the app's real strings */
  cta: string;
};

export const FILMS: Film[] = [
  {
    // Genre: clinical procedural. The machine is the only honest thing in the
    // room and Dave loses to it in one syllable.
    //
    // Envelope: question 2.2–4.7, "No." at 6.0 (0.2s — one syllable, which is
    // how we know it landed), needle detonates 7.8–9.8. The 1.2s of nothing
    // between the answer and the machine's reaction is the best beat in the
    // batch. Do not tighten it. Deadpan needs the room.
    name: "polygraph",
    angle: "the football lie detector",
    segments: [{ from: 0.6, to: 10.0 }],
    accent: "red",
    hook: "THE FOOTBALL LIE DETECTOR",
    cues: [
      { at: 2.2, dur: 2.6, text: "Have you ever stated a football fact you weren't sure of?", tone: "quiet" },
      { at: 6.0, dur: 1.4, text: "No.", tone: "loud" },
    ],
    verdict: "DAVE FAILED.",
    // the polygraph hands the viewer the electrodes: same chair, one question
    demo: {
      header: "YOUR TURN IN THE CHAIR.",
      qLabel: "Q3/10",
      question: "Ronaldo's first senior club?",
      options: ["Man Utd", "Sporting CP", "Benfica", "Porto"],
      correct: 1,
      dave: 0,
      daveTag: "DAVE, UNDER OATH",
      result: "THE MACHINE WAS RIGHT.",
    },
    turn: "SO WOULD YOU.",
    cta: "Find out what you actually know.",
  },
  {
    // Genre: church-hall support group. The warmest film, and the only one
    // where Dave says the take out loud to a room instead of into a group chat.
    //
    // Envelope, at 50ms — and read the LEVELS, not just the gaps, because the
    // first cut of this film got it wrong and shipped:
    //
    //   0.05–0.55  loud, ~22/50, close-mic, two bursts → DAVE: "My name's Dave."
    //   1.20–2.05  quiet, ~5–11/50, one swell that rises and fades
    //                                        → THE ROOM, at distance: "Hi, Dave."
    //   2.05–5.40  nothing
    //   5.50–7.20  loud, close, varied       → DAVE: the take
    //   7.30–10.0  dead
    //
    // The trap: that opening burst looks like a door slam or room tone if you
    // only skim for gaps, so the first pass trimmed it off at 0.9 and captioned
    // the room's reply with Dave's line — the one thing in the batch a viewer
    // caught instantly, because they could hear a dozen people say "Hi, Dave"
    // while the screen said "My name's Dave."
    //
    // **Amplitude tells you who is speaking.** Close-mic and loud is the man in
    // front of the camera; a group at the back of a church hall is quiet even
    // when it's a dozen of them. A unison chorus also has a shape — one swell,
    // up and down — where a sentence has syllables. Check the mouth in the
    // frame if you're unsure; it costs one `-ss` extract and it is decisive.
    //
    // Nothing is trimmed off the head now: Dave's introduction IS the first
    // thing said and it's the setup for the whole ritual. Only the sagging
    // middle and the dead tail go.
    name: "support-group",
    angle: "the take, said out loud, to a room",
    segments: [
      { from: 0.0, to: 2.6 },
      { from: 4.9, to: 7.4 },
    ],
    accent: "orange",
    hook: "FOOTBALL OPINIONS ANONYMOUS",
    cues: [
      // the ritual runs deadpan in the quiet register — him, then them — so
      // that the take can be the only thing in the film that shouts
      { at: 0.05, dur: 1.05, text: "My name's Dave.", tone: "quiet" },
      { at: 1.2, dur: 1.15, text: "Hi, Dave.", tone: "quiet" },
      { at: 5.6, dur: 1.8, text: "He's not even top 10 all time.", tone: "loud" },
    ],
    verdict: "STILL NOT SORRY.",
    // twelve-step programme, step one: facts. Dave picks with his heart, which
    // in this church hall is called a relapse.
    demo: {
      header: "STEP 1: FACTS.",
      qLabel: "Q7/10",
      question: "Most Ballons d'Or?",
      options: ["Ronaldo", "Platini", "Messi", "Cruyff"],
      correct: 2,
      dave: 0,
      daveTag: "DAVE, NOT SORRY",
      result: "RELAPSE.",
    },
    turn: "SETTLE IT PROPERLY.",
    cta: "A new football challenge every day.",
  },
  {
    // Genre: wildlife documentary. Dave is observed, never addressed — the one
    // film where he does not know he is the subject, which is why it's the one
    // that stings.
    //
    // Envelope: narrator runs 1.7–3.5, 3.9–5.2, 5.9–7.2, 7.9–9.3. Well paced
    // on its own; only the head needs taking off.
    name: "nature",
    angle: "the fan, observed in his natural habitat",
    segments: [{ from: 1.4, to: 9.6 }],
    accent: "lime",
    hook: "THE COMMON FOOTBALL MAN",
    cues: [
      { at: 1.8, dur: 3.2, text: "The male asserts dominance by listing players.", tone: "quiet" },
      { at: 5.9, dur: 1.6, text: "He has no evidence.", tone: "quiet" },
      { at: 7.9, dur: 1.6, text: "He has never needed any.", tone: "quiet" },
    ],
    verdict: "ZERO EVIDENCE.",
    // the documentary presents the specimen with an actual fact. He selects
    // the biggest number, as the wild dictates.
    demo: {
      header: "A FACT, IN THE WILD.",
      qLabel: "Q2/10",
      question: "How many World Cups has Brazil won?",
      options: ["3", "4", "5", "6"],
      correct: 2,
      dave: 3,
      daveTag: "THE SPECIMEN",
      result: "STILL NO EVIDENCE.",
    },
    turn: "SOUND FAMILIAR?",
    cta: "Test your football brain daily.",
  },
  {
    // Genre: 1978 public information film. Pure texture — 16mm grain, gate
    // weave and institutional dread, the one thing a vector renderer physically
    // cannot fake. Deadpan throughout; there is no wink anywhere in it.
    //
    // Envelope: narrator 1.1–4.8, 5.5–6.8, 7.9–9.0. Clean.
    name: "warning",
    angle: "a public information film about football ignorance",
    segments: [{ from: 0.9, to: 9.2 }],
    accent: "blue",
    hook: "FOOTBALL IGNORANCE",
    cues: [
      { at: 2.1, dur: 2.8, text: "Each year, thousands of men give an opinion they cannot support.", tone: "quiet" },
      { at: 5.5, dur: 1.4, text: "Football ignorance.", tone: "loud" },
      { at: 7.9, dur: 1.4, text: "It can happen to anyone.", tone: "quiet" },
    ],
    verdict: "VIBES ONLY.",
    // the public information film runs its screening programme. Dave is the
    // case study the leaflet warned about.
    demo: {
      header: "KNOW THE SIGNS.",
      qLabel: "Q9/10",
      question: "Who won the first World Cup, in 1930?",
      options: ["Italy", "Argentina", "Brazil", "Uruguay"],
      correct: 3,
      dave: 2,
      daveTag: "CASE STUDY: DAVE",
      result: "IT HAPPENED TO DAVE.",
    },
    turn: "EARN YOURS.",
    cta: "Football quizzes, every single day.",
  },
];

export const byName = (n: string): Film | undefined => FILMS.find((f) => f.name === n);

const segLen = (s: Seg) => s.to - s.from;

/** seconds of footage kept, after the cuts */
export const footageSec = (f: Film): number => f.segments.reduce((a, s) => a + segLen(s), 0);
export const footageFrames = (f: Film): number => Math.round(footageSec(f) * FPS);
export const totalFrames = (f: Film): number => footageFrames(f) + SNAP;

/**
 * Source second → finished-timeline second, walking the segment map.
 *
 * Cues are authored against the envelope (source time) because that is the
 * only thing you can actually measure; this is what re-times them after the
 * cuts. A cue that falls in a removed slice returns null and simply doesn't
 * render — cutting a line out of the film should not leave its caption
 * floating over the next shot.
 */
export const srcToTimeline = (f: Film, t: number): number | null => {
  let acc = 0;
  for (const s of f.segments) {
    if (t >= s.from && t < s.to) return acc + (t - s.from);
    acc += segLen(s);
  }
  return null;
};

import React from "react";
import { Composition } from "remotion";
import { CareerPathReveal, CareerPathEntry, clubsForDisplay } from "./CareerPathReveal";
import { FPS, phases } from "./timing";
import { BrandPromo } from "./promo/BrandPromo";
import { TOTAL as PROMO_TOTAL, FPS as PROMO_FPS } from "./promo/timeline";
import { Versus } from "./promo/versus/Versus";
import { TOTAL as VERSUS_TOTAL, FPS as VERSUS_FPS } from "./promo/versus/timeline";
import { QuizTease } from "./promo/quiztease/QuizTease";
import { TOTAL as QUIZ_TOTAL, FPS as QUIZ_FPS } from "./promo/quiztease/timeline";
import { GroupChat } from "./promo/groupchat/GroupChat";
import { TOTAL as GROUPCHAT_TOTAL, FPS as GROUPCHAT_FPS } from "./promo/groupchat/timeline";
import { OneMore } from "./promo/onemore/OneMore";
import { TOTAL as ONEMORE_TOTAL, FPS as ONEMORE_FPS } from "./promo/onemore/timeline";
import { Anthem } from "./promo/anthem/Anthem";
import { TOTAL as ANTHEM_TOTAL, FPS as ANTHEM_FPS } from "./promo/anthem/timeline";
import { Breaking } from "./promo/breaking/Breaking";
import { TOTAL as BREAKING_TOTAL, FPS as BREAKING_FPS } from "./promo/breaking/timeline";
import { Wrapped } from "./promo/wrapped/Wrapped";
import { TOTAL as WRAPPED_TOTAL, FPS as WRAPPED_FPS } from "./promo/wrapped/timeline";
import { FanTypes } from "./promo/fantypes/FanTypes";
import { TOTAL as FANTYPES_TOTAL, FPS as FANTYPES_FPS } from "./promo/fantypes/timeline";
import { Rematch } from "./promo/rematch/Rematch";
import { TOTAL as REMATCH_TOTAL, FPS as REMATCH_FPS } from "./promo/rematch/timeline";
import { Remember } from "./promo/remember/Remember";
import { TOTAL as REMEMBER_TOTAL, FPS as REMEMBER_FPS } from "./promo/remember/timeline";
import { License } from "./promo/license/License";
import { TOTAL as LICENSE_TOTAL, FPS as LICENSE_FPS } from "./promo/license/timeline";
import { Final } from "./promo/final/Final";
import { TOTAL as FINAL_TOTAL, FPS as FINAL_FPS } from "./promo/final/timeline";
import { Horror } from "./promo/horror/Horror";
import { TOTAL as HORROR_TOTAL, FPS as HORROR_FPS } from "./promo/horror/timeline";
import { Asmr } from "./promo/asmr/Asmr";
import { TOTAL as ASMR_TOTAL, FPS as ASMR_FPS } from "./promo/asmr/timeline";
import { Speedrun } from "./promo/speedrun/Speedrun";
import { TOTAL as SPEEDRUN_TOTAL, FPS as SPEEDRUN_FPS } from "./promo/speedrun/timeline";
import { Tutorial } from "./promo/tutorial/Tutorial";
import { TOTAL as TUTORIAL_TOTAL, FPS as TUTORIAL_FPS } from "./promo/tutorial/timeline";
import { Receipt } from "./promo/receipt/Receipt";
import { TOTAL as RECEIPT_TOTAL, FPS as RECEIPT_FPS } from "./promo/receipt/timeline";
import { Departures } from "./promo/departures/Departures";
import { TOTAL as DEPARTURES_TOTAL, FPS as DEPARTURES_FPS } from "./promo/departures/timeline";
import { Loop } from "./promo/loop/Loop";
import { TOTAL as LOOP_TOTAL, FPS as LOOP_FPS } from "./promo/loop/timeline";
import { SemiFinal } from "./promo/semifinal/SemiFinal";
import { TOTAL as SEMI_TOTAL, FPS as SEMI_FPS } from "./promo/semifinal/timeline";
import { TheDecision } from "./promo/draw/TheDecision";
import { TOTAL as DRAW_TOTAL, FPS as DRAW_FPS } from "./promo/draw/timeline";
import { Ladder } from "./promo/ladder/Ladder";
import { TOTAL as LADDER_TOTAL, FPS as LADDER_FPS } from "./promo/ladder/timeline";
import { LadderLong } from "./promo/ladderlong/LadderLong";
import {
  EDITIONS as LL_EDITIONS,
  totalOf as llTotalOf,
  FPS as LL_FPS,
} from "./promo/ladderlong/timeline";
import { Chain } from "./promo/chain/Chain";
import { TOTAL as CHAIN_TOTAL, FPS as CHAIN_FPS } from "./promo/chain/timeline";
import { ChainLong } from "./promo/chainlong/ChainLong";
import {
  EDITIONS as CL_EDITIONS,
  totalOf as clTotalOf,
  FPS as CL_FPS,
} from "./promo/chainlong/timeline";
import { Wall } from "./promo/wall/Wall";
import { TOTAL as WALL_TOTAL, FPS as WALL_FPS } from "./promo/wall/timeline";
import { PickASide } from "./promo/pickaside/PickASide";
import { TOTAL as PICK_TOTAL, FPS as PICK_FPS } from "./promo/pickaside/timeline";
import { LongChain } from "./promo/longchain/LongChain";
import { TOTAL as LONG_TOTAL, FPS as LONG_FPS } from "./promo/longchain/timeline";
import { NotTelling } from "./promo/nottelling/NotTelling";
import { TOTAL as NOTTELL_TOTAL, FPS as NOTTELL_FPS } from "./promo/nottelling/timeline";
import { DaveFilm } from "./dave/DaveFilm";
import { FILMS, FPS as DAVE_FPS, totalFrames as daveTotal } from "./dave/films";
import { Stinger } from "./weekend/stinger/Stinger";
import { TOTAL as WKND_STINGER_TOTAL, FPS as WKND_STINGER_FPS } from "./weekend/stinger/timeline";
import { Manifesto } from "./weekend/manifesto/Manifesto";
import { TOTAL as WKND_MANIFESTO_TOTAL, FPS as WKND_MANIFESTO_FPS } from "./weekend/manifesto/timeline";
import { SettleIt, SETTLEIT_TOTAL } from "./weekend/reels/SettleIt";
import { Referee, REFEREE_TOTAL } from "./weekend/reels/Referee";
import { Squad, SQUAD_TOTAL } from "./weekend/reels/Squad";
import { Boost, BOOST_TOTAL } from "./weekend/reels/Boost";
import { Dilemma, DILEMMA_EDITIONS, dilemmaTotal } from "./weekend/reels/Dilemma";
import { FPS as WKND_REELS_FPS } from "./weekend/reels/timeline";

// Studio preview default only — render.mjs injects the real entry per video.
// A loan-heavy path so the LOAN badge is visible in the studio preview.
const SAMPLE: CareerPathEntry = {
  id: "cp-coutinho",
  answerName: "Philippe Coutinho",
  clubs: [
    "Vasco da Gama",
    "Inter Milan",
    { name: "Espanyol", loan: true },
    "Liverpool",
    "Barcelona",
    { name: "Bayern Munich", loan: true },
    { name: "Aston Villa", loan: true },
    "Al-Duhail",
    "Vasco da Gama",
  ],
  difficulty: "medium",
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="CareerPathReveal"
      component={CareerPathReveal}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={phases(clubsForDisplay(SAMPLE.clubs).length).total}
      defaultProps={{ entry: SAMPLE }}
      calculateMetadata={({ props }) => ({
        durationInFrames: phases(clubsForDisplay(props.entry.clubs).length).total,
      })}
    />
    <Composition
      id="BrandPromo"
      component={BrandPromo}
      fps={PROMO_FPS}
      width={1080}
      height={1920}
      durationInFrames={PROMO_TOTAL}
    />
    <Composition
      id="Versus"
      component={Versus}
      fps={VERSUS_FPS}
      width={1080}
      height={1920}
      durationInFrames={VERSUS_TOTAL}
    />
    <Composition
      id="QuizTease"
      component={QuizTease}
      fps={QUIZ_FPS}
      width={1080}
      height={1920}
      durationInFrames={QUIZ_TOTAL}
    />
    <Composition
      id="GroupChat"
      component={GroupChat}
      fps={GROUPCHAT_FPS}
      width={1080}
      height={1920}
      durationInFrames={GROUPCHAT_TOTAL}
    />
    <Composition
      id="OneMore"
      component={OneMore}
      fps={ONEMORE_FPS}
      width={1080}
      height={1920}
      durationInFrames={ONEMORE_TOTAL}
    />
    <Composition
      id="Anthem"
      component={Anthem}
      fps={ANTHEM_FPS}
      width={1080}
      height={1920}
      durationInFrames={ANTHEM_TOTAL}
    />
    <Composition
      id="Breaking"
      component={Breaking}
      fps={BREAKING_FPS}
      width={1080}
      height={1920}
      durationInFrames={BREAKING_TOTAL}
    />
    <Composition
      id="Wrapped"
      component={Wrapped}
      fps={WRAPPED_FPS}
      width={1080}
      height={1920}
      durationInFrames={WRAPPED_TOTAL}
    />
    <Composition
      id="FanTypes"
      component={FanTypes}
      fps={FANTYPES_FPS}
      width={1080}
      height={1920}
      durationInFrames={FANTYPES_TOTAL}
    />
    <Composition
      id="Rematch"
      component={Rematch}
      fps={REMATCH_FPS}
      width={1080}
      height={1920}
      durationInFrames={REMATCH_TOTAL}
    />
    <Composition
      id="Remember"
      component={Remember}
      fps={REMEMBER_FPS}
      width={1080}
      height={1920}
      durationInFrames={REMEMBER_TOTAL}
    />
    <Composition
      id="License"
      component={License}
      fps={LICENSE_FPS}
      width={1080}
      height={1920}
      durationInFrames={LICENSE_TOTAL}
    />
    <Composition
      id="Final"
      component={Final}
      fps={FINAL_FPS}
      width={1080}
      height={1920}
      durationInFrames={FINAL_TOTAL}
    />
    <Composition
      id="Horror"
      component={Horror}
      fps={HORROR_FPS}
      width={1080}
      height={1920}
      durationInFrames={HORROR_TOTAL}
    />
    <Composition
      id="Asmr"
      component={Asmr}
      fps={ASMR_FPS}
      width={1080}
      height={1920}
      durationInFrames={ASMR_TOTAL}
    />
    <Composition
      id="Speedrun"
      component={Speedrun}
      fps={SPEEDRUN_FPS}
      width={1080}
      height={1920}
      durationInFrames={SPEEDRUN_TOTAL}
    />
    <Composition
      id="Tutorial"
      component={Tutorial}
      fps={TUTORIAL_FPS}
      width={1080}
      height={1920}
      durationInFrames={TUTORIAL_TOTAL}
    />
    <Composition
      id="Receipt"
      component={Receipt}
      fps={RECEIPT_FPS}
      width={1080}
      height={1920}
      durationInFrames={RECEIPT_TOTAL}
    />
    <Composition
      id="Departures"
      component={Departures}
      fps={DEPARTURES_FPS}
      width={1080}
      height={1920}
      durationInFrames={DEPARTURES_TOTAL}
    />
    <Composition
      id="Loop"
      component={Loop}
      fps={LOOP_FPS}
      width={1080}
      height={1920}
      durationInFrames={LOOP_TOTAL}
    />
    <Composition
      id="SemiFinal"
      component={SemiFinal}
      fps={SEMI_FPS}
      width={1080}
      height={1920}
      durationInFrames={SEMI_TOTAL}
    />
    <Composition
      id="TheDecision"
      component={TheDecision}
      fps={DRAW_FPS}
      width={1080}
      height={1920}
      durationInFrames={DRAW_TOTAL}
    />

    {/* THE RETENTION LANE — three formats built against what actually holds a
        viewer past 4s, rather than against one puzzle per video. See each
        timeline.ts for the specific mechanic and why it beats a single reveal. */}
    <Composition
      id="Ladder"
      component={Ladder}
      fps={LADDER_FPS}
      width={1080}
      height={1920}
      durationInFrames={LADDER_TOTAL}
    />
    <Composition
      id="Chain"
      component={Chain}
      fps={CHAIN_FPS}
      width={1080}
      height={1920}
      durationInFrames={CHAIN_TOTAL}
    />
    <Composition
      id="Wall"
      component={Wall}
      fps={WALL_FPS}
      width={1080}
      height={1920}
      durationInFrames={WALL_TOTAL}
    />

    {/* The format-test batch (2026-07-25). These three are not three guesses —
        each moves ONE variable against CHAIN, our best performer, so the result
        is readable. PickASide changes the question type (H1), LongChain changes
        the length (H3), NotTelling pushes withholding to its limit (H2). The
        hypotheses and the sweep behind them are in RESEARCH_DIGEST.md; the
        beat sheets and the fact-check log are in SCRIPTS_PHASE2.md. Post them
        on separate days — two on one day contaminates the read. */}
    <Composition
      id="PickASide"
      component={PickASide}
      fps={PICK_FPS}
      width={1080}
      height={1920}
      durationInFrames={PICK_TOTAL}
    />
    <Composition
      id="LongChain"
      component={LongChain}
      fps={LONG_FPS}
      width={1080}
      height={1920}
      durationInFrames={LONG_TOTAL}
    />
    <Composition
      id="NotTelling"
      component={NotTelling}
      fps={NOTTELL_FPS}
      width={1080}
      height={1920}
      durationInFrames={NOTTELL_TOTAL}
    />

    {/* THE WEEKEND — the CT-1 campaign lane (ink ground, lime lead: the
        teaser card's world, not the cream quiz brand). Rendered by weekend.mjs,
        never promo.mjs — the campaign can't destabilise the promo lane. */}
    <Composition
      id="WkndStinger"
      component={Stinger}
      fps={WKND_STINGER_FPS}
      width={1080}
      height={1920}
      durationInFrames={WKND_STINGER_TOTAL}
    />
    <Composition
      id="WkndManifesto"
      component={Manifesto}
      fps={WKND_MANIFESTO_FPS}
      width={1080}
      height={1920}
      durationInFrames={WKND_MANIFESTO_TOTAL}
    />

    {/* CF-WEEKEND — the three post-launch reels (each reel IS the game; the
        product is the payoff frame). Narrated: Charlie via weekend/reels-vo.mjs,
        timing truth in weekend/reels/grid.json. */}
    <Composition
      id="WkndSettleIt"
      component={SettleIt}
      fps={WKND_REELS_FPS}
      width={1080}
      height={1920}
      durationInFrames={SETTLEIT_TOTAL}
    />
    <Composition
      id="WkndReferee"
      component={Referee}
      fps={WKND_REELS_FPS}
      width={1080}
      height={1920}
      durationInFrames={REFEREE_TOTAL}
    />
    <Composition
      id="WkndSquad"
      component={Squad}
      fps={WKND_REELS_FPS}
      width={1080}
      height={1920}
      durationInFrames={SQUAD_TOTAL}
    />
    {/* CF-42H — the paid-boost conversion reel. Facts re-verified against
        prod by weekend/boost-live.mjs on every render; render via
        weekend/render-42h.mjs (the one command), never straight weekend.mjs. */}
    <Composition
      id="Wknd42h"
      component={Boost}
      fps={WKND_REELS_FPS}
      width={1080}
      height={1920}
      durationInFrames={BOOST_TOTAL}
    />

    {/* DILEMMA-B1 — "the-dilemma", the experiment lane's second occupant
        (chain-long killed on the lane law, 2026-08-14). One real draft decision
        per edition and NO resolution; the format exists to carry the live CTA
        and to collect votes, so comments/1000 is a co-primary read. Casting +
        prices are the prod board's, re-verified on every render by
        weekend/dilemma-live.mjs — render via weekend/render-dilemma.mjs (the
        one command), never straight weekend.mjs. A third edition is a row in
        src/weekend/reels/dilemma-facts.json plus its grid entry, nothing else. */}
    {DILEMMA_EDITIONS.map((ed) => (
      <Composition
        key={ed.slug}
        id={`WkndDilemma-${ed.id}`}
        component={Dilemma}
        fps={WKND_REELS_FPS}
        width={1080}
        height={1920}
        durationInFrames={dilemmaTotal(ed.id)}
        defaultProps={{ id: ed.id }}
      />
    ))}

    {/* THE DAVE TAPES — the live-action lane. One component, one row of data
        per film, so a fifth film is a clip plus a table entry rather than
        another bespoke folder. See src/dave/films.ts for why Dave. */}
    {FILMS.map((film) => (
      <Composition
        key={film.name}
        id={`Dave-${film.name}`}
        component={DaveFilm}
        fps={DAVE_FPS}
        width={1080}
        height={1920}
        durationInFrames={daveTotal(film)}
        defaultProps={{ film }}
      />
    ))}

    {/* LADDER-LONG — the retention lane at the cadence the faceless winners
        actually run. One component, one row of casting per edition (same shape
        as the Dave lane), so a fifth edition is a table entry in
        src/promo/ladderlong/timeline.ts and nothing else. Duration is derived
        PER EDITION because batch 2 runs a cadence A/B — 78.00s at 7.00s/rung,
        63.00s at 5.50s/rung — while batch 1 stays pinned at the 76.00s it
        shipped as. */}
    {LL_EDITIONS.map((ed) => (
      <Composition
        key={ed.slug}
        id={`LadderLong-${ed.slug}`}
        component={LadderLong}
        fps={LL_FPS}
        width={1080}
        height={1920}
        durationInFrames={llTotalOf(ed)}
        defaultProps={{ slug: ed.slug }}
      />
    ))}

    {/* CHAIN-LONG — the experiment lane's first occupant (CHAIN-LONG-B1):
        the relay mechanic on the standing 7.00s winner grid. Same one-row-per
        -edition shape as ladder-long; a third edition is a table entry in
        src/promo/chainlong/timeline.ts and nothing else. */}
    {CL_EDITIONS.map((ed) => (
      <Composition
        key={ed.slug}
        id={`ChainLong-${ed.slug}`}
        component={ChainLong}
        fps={CL_FPS}
        width={1080}
        height={1920}
        durationInFrames={clTotalOf(ed)}
        defaultProps={{ slug: ed.slug }}
      />
    ))}
  </>
);

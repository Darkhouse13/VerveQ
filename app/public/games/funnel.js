/**
 * Curiosity funnel for the static /games/ SEO pages.
 *
 * These pages are hand-written HTML served straight from public/ — no bundler,
 * no env substitution, no React. They are also the ONLY surface where this
 * funnel is honest: every in-app mode provisions its session in a mount effect
 * (arriving IS starting) and Career Path has no CTA at all, so "saw the button
 * and didn't press it" cannot exist in the app. Here it can: there is a real
 * button, a real fold, and a real decision.
 *
 * Identity continuity is why this loads posthog-js rather than POSTing to the
 * capture API by hand: the SDK keys its localStorage off the project token, so
 * on the same origin these pages and the SPA share one anonymous distinct_id.
 * A visitor who reads /games/career-path and then clicks through to / is ONE
 * person, and their pre-claim history survives a later username_claimed.
 * Hand-rolling capture would mint a second id and split them in two.
 *
 * Config mirrors lib/analytics.ts deliberately — notably persistence:
 * "localStorage". If these pages used cookies while the SPA used localStorage,
 * the two would never share an id and the funnel would measure nothing.
 */
(function () {
  "use strict";

  var TOKEN = "phc_BowB32VMjQxMAg3QLPUxm2yVpDVVKviT9z9bVZ7zY8rs";
  var API_HOST = "https://eu.i.posthog.com";
  var PROD_HOSTS = ["verveq.com", "www.verveq.com"];

  var isProdHost = PROD_HOSTS.indexOf(location.hostname) !== -1;
  var isTest = /[?&]vq_test=1(?:&|$)/.test(location.search);

  // Fail closed, mirroring lib/analytics.ts' PROD+key gate: the live host
  // reports real traffic; anywhere else (localhost, previews) stays silent
  // unless it explicitly opts in, and everything it then sends is tagged test.
  // So a developer running `vite preview` cannot dirty the baseline by accident.
  if (!isProdHost && !isTest) return;

  // The page's own directory names the mode. Static pages, one per mode — no
  // routing involved, so this cannot drift the way an SPA path can.
  var MODE_BY_SLUG = {
    "career-path": "career-path",
    "daily-football-quiz": "daily",
    "football-survival": "survival",
    "higher-or-lower": "higher-lower",
    "football-grid": "verve-grid",
    "football-duels": "duel",
  };
  var slug = (location.pathname.match(/\/games\/([^/]+)\//) || [])[1] || "";
  var mode = MODE_BY_SLUG[slug] || null; // /games/ itself indexes them all

  /* prettier-ignore */
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  // ── funnel state ──────────────────────────────────────────────────────────
  var STEPS = ["landing", "cta_shown", "interacted", "start_intent"];
  var furthest = "landing";
  var landedAtMs = Date.now();
  var exitFired = false;
  var intentFired = false;
  var seenInteractions = {};

  function advance(step) {
    if (STEPS.indexOf(step) > STEPS.indexOf(furthest)) furthest = step;
  }

  posthog.init(TOKEN, {
    api_host: API_HOST,
    autocapture: false,
    // Classic multi-page HTML: one load is one pageview, so unlike the SPA
    // (which captures manually on route change) the default is correct here.
    // This is the first pageview these pages have ever reported.
    capture_pageview: true,
    // The exit event below is deliberate and carries furthest_step; PostHog's
    // generic $pageleave would only duplicate it without the step.
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "localStorage",
    person_profiles: "identified_only",
    // Only ever true for a ?vq_test=1 run off the production host. posthog-js
    // silently drops everything an automated browser sends (UA blocklist,
    // userAgentData.brands, navigator.webdriver), so the scripted pass cannot
    // observe itself without this. Left ON for real traffic, where it is what
    // keeps Googlebot and friends out of the curiosity funnel.
    opt_out_useragent_filter: isTest,
    loaded: function (ph) {
      if (isTest) ph.register({ is_test: true, env: "test" });
      start(ph);
    },
  });

  function start(ph) {
    // A previously-identified browser has $user_id in persistence. It is the
    // only auth signal available here — these pages have no Convex client and
    // cannot see session state. Read AFTER load: the pre-load stub queues
    // calls and returns undefined, so asking it anything yields a false
    // "anonymous".
    var isAuthenticated = !!ph.get_property("$user_id");

    ph.capture("landing_viewed", {
      // Extends the SPA's entry_source enum (share-link/homepage/profile/
      // direct), which predates these pages. Organic search is its own door
      // and calling it "direct" would be a lie.
      entry_source: "seo",
      mode: mode,
      is_authenticated: isAuthenticated,
      referrer_domain: referrerDomain(),
    });

    watchCta(ph);
    watchInteraction(ph);
    watchIntent(ph);
    watchExit(ph);
  }

  function referrerDomain() {
    try {
      return document.referrer ? new URL(document.referrer).hostname : null;
    } catch (e) {
      return null;
    }
  }

  // ── landing_cta_shown: visible, not merely present ─────────────────────────
  function watchCta(ph) {
    var cta = document.querySelector("a.cta");
    if (!cta) return;

    // No IntersectionObserver (old Safari): report nothing rather than guess
    // at visibility. A missing step is honest; a fabricated one corrupts
    // furthest_step, which is the whole point of the funnel.
    if (typeof IntersectionObserver === "undefined") return;

    var io = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          // Half the button on screen, and the tab actually foregrounded — a
          // background/prerendered tab can satisfy intersection while no human
          // has seen anything.
          if (!entries[i].isIntersecting) continue;
          if (document.visibilityState !== "visible") continue;
          io.disconnect();
          advance("cta_shown");
          ph.capture("landing_cta_shown", { mode: mode });
          return;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(cta);
  }

  // ── landing_interacted ────────────────────────────────────────────────────
  function watchInteraction(ph) {
    function fire(type) {
      if (seenInteractions[type]) return;
      seenInteractions[type] = true;
      advance("interacted");
      ph.capture("landing_interacted", { interaction_type: type, mode: mode });
    }

    window.addEventListener(
      "scroll",
      function () {
        if (window.scrollY > window.innerHeight * 0.5) fire("scroll_past_fold");
      },
      { passive: true },
    );

    // A tap on the CTA is intent, not idle interaction — watchIntent owns it.
    document.addEventListener(
      "click",
      function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest("a.cta")) return;
        fire("tap");
      },
      { passive: true },
    );
  }

  // ── game_start_intent ─────────────────────────────────────────────────────
  function watchIntent(ph) {
    var cta = document.querySelector("a.cta");
    if (!cta) return;
    cta.addEventListener("click", function () {
      if (intentFired) return;
      intentFired = true;
      advance("start_intent");
      // sendBeacon: this click navigates away immediately, so a normal XHR can
      // be cancelled mid-flight by the unload.
      ph.capture(
        "game_start_intent",
        { mode: mode, time_on_page_seconds: secondsHere() },
        { transport: "sendBeacon" },
      );
    });
  }

  // ── exit_before_play ──────────────────────────────────────────────────────
  function watchExit(ph) {
    function exit(signal) {
      if (exitFired) return;
      // Pressing the CTA is a hand-off to the app, not an exit before play.
      // Whether a game then started is answered by the SPA's game_started, and
      // joining the two is analysis-time work — firing exit_before_play here
      // would count every converting visitor as a bounce.
      if (intentFired) return;
      exitFired = true;
      ph.capture(
        "exit_before_play",
        {
          mode: mode,
          furthest_step: furthest,
          time_on_page_seconds: secondsHere(),
          exit_signal: signal,
        },
        { transport: "sendBeacon" },
      );
    }

    // Both, first-one-wins. pagehide covers same-tab navigation and most
    // closes; visibilitychange->hidden is the only signal mobile reliably
    // gives when the app is switched away. Neither alone is sufficient, and
    // there is no event that means "gone for good" — a backgrounded tab the
    // visitor later returns to still reports here, which is why exit_signal
    // rides along so analysis can separate the two.
    window.addEventListener("pagehide", function () {
      exit("pagehide");
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") exit("visibility_hidden");
    });
  }

  function secondsHere() {
    return Math.round((Date.now() - landedAtMs) / 1000);
  }
})();

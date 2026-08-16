/**
 * THE WEEKEND × Home — the live-mode entry card (FW-GO).
 *
 * Replaces the pre-launch waitlist teaser (Ticket FW-P1): same slot, same
 * lime-on-black hero family, but the mode is LIVE — the one action is
 * "Play now", straight into the WEEKEND hub. The COUNT-ME-IN / email waitlist
 * paths and their `waitlist_*` events are retired with the launch; the events
 * remain documented in docs/ANALYTICS.md as historical.
 *
 * Static by design: no server read gates this card. The mode is launched and
 * linked, so the entry point renders unconditionally — the surfaces behind it
 * carry the honest fail-closed states ("no board is open right now") when the
 * backend has nothing to serve.
 *
 * Analytics (ANALYTICS.md: real user actions only, never route views):
 * `weekend_entry_clicked` fires on the CTA tap, with the same
 * source-attribution vocabulary the teaser used; landing on the hub itself
 * fires nothing.
 */

import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarRange } from "lucide-react";
import { track } from "@/lib/analytics";
import { readColdSource } from "@/lib/coldSession";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { NeoButton } from "@/components/neo/NeoButton";

// "Eight leagues, one squad" is the FW-EXPAND R3 framing (owner ruling
// 2026-08-02) — the five-league claim is dead everywhere.
export function HomeWeekendCard() {
  const navigate = useNavigate();
  const { t } = useTranslation("shell");
  const tr = (key: string, fallback: string) => {
    const translated = t(key, { defaultValue: fallback });
    return translated === key ? fallback : translated;
  };
  const bullets = [
    tr("weekend.homeBulletLeagues", "Eight leagues, one squad"),
    tr("weekend.homeBulletCrowd", "The crowd rates the players, not an algorithm"),
    tr("weekend.homeBulletFresh", "Fresh draft every week, no season-long grind"),
  ];

  // Attribution: utm_source ?? ref from the landing URL, else the placement
  // tag. Read once per mount — the entry's source is where the visit came
  // from, not where the SPA has since navigated. (Teaser vocabulary, kept.)
  const sourceRef = useRef<string | undefined>(undefined);
  if (sourceRef.current === undefined) {
    sourceRef.current = readColdSource() ?? "home_card";
  }
  const source = sourceRef.current;

  const enter = () => {
    track("weekend_entry_clicked", { source, placement: "home_card" });
    navigate(SHELL_ROUTES.weekend);
  };

  return (
    <div className="shrink-0 pb-3 md:pb-4" data-testid="home-weekend-card">
      <div className="neo-border neo-shadow-lg rounded-lg bg-foreground text-background p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {/* Pitch column */}
        <div className="min-w-0 md:flex-1">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent flex items-center gap-1.5">
            <CalendarRange size={12} strokeWidth={3} />
            {tr("weekend.homeEyebrow", "New mode · Live now")}
          </p>
          <p className="font-heading font-black uppercase leading-[0.95] text-[34px] md:text-[42px] text-accent mt-1.5">
            {tr("weekend.hubTitle", "The Weekend")}
          </p>
          <p className="font-heading font-bold text-base md:text-lg leading-tight mt-2">
            {tr("weekend.homeHeadline", "Draft the whole European football weekend.")}
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {bullets.map((line) => (
              <li
                key={line}
                className="font-mono text-[11px] uppercase tracking-wide text-background/70 flex gap-2"
              >
                <span aria-hidden className="text-accent">
                  ■
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action column */}
        <div className="md:w-[300px] md:shrink-0 flex flex-col gap-2">
          <NeoButton
            variant="accent"
            size="full"
            onClick={enter}
            data-testid="weekend-cta-play"
          >
            {tr("weekend.homePlay", "Play now")}
          </NeoButton>
          <p className="font-mono text-[10.5px] uppercase text-background/60">
            {tr("weekend.homeNote", "Budget squad or crew draft — fresh board every weekend.")}
          </p>
        </div>
      </div>
    </div>
  );
}

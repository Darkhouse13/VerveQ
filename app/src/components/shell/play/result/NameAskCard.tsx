/**
 * The soft name ask (owner ruling 2026-10-22): after a finished daily, a
 * player with no name sees one quiet card offering one. Never before or during
 * play, never to someone who already has a name, and "Skip" hides it for the
 * rest of the day.
 *
 * The copy only promises what a name does: a shared challenge shows it
 * ("a friend" without one). It does not move the streak to another device —
 * that takes an email and password — so the card doesn't claim it.
 */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AtSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

const SKIP_KEY = "vq.nameAskSkipped";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function skippedToday(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === today();
  } catch {
    return false;
  }
}

export function NameAskCard() {
  const { t } = useTranslation("play");
  const { accountState } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [hidden, setHidden] = useState(skippedToday);

  // "needsUsername" is a signed-in guest session with no name yet.
  if (accountState !== "needsUsername" || hidden) return null;

  const skip = () => {
    try {
      localStorage.setItem(SKIP_KEY, today());
    } catch {
      // Storage blocked: hide it for this screen only.
    }
    setHidden(true);
  };
  const pick = () =>
    navigate(`${SHELL_ROUTES.welcome}?next=${encodeURIComponent(`${pathname}${search}`)}`);

  return (
    <section
      className="flex flex-col gap-3 rounded-lg bg-card p-3 text-card-foreground neo-border"
      data-testid="result-name-ask"
      aria-labelledby="result-name-ask-title"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-muted neo-border" aria-hidden="true">
          <AtSign size={20} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p id="result-name-ask-title" className="font-heading font-bold text-body">
            {t("result.nameAsk.title")}
          </p>
          <p className="text-meta text-muted-foreground">{t("result.nameAsk.body")}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="md" className="flex-1" onClick={pick} data-testid="result-name-ask-pick">
          {t("result.nameAsk.pick")}
        </Button>
        <Button variant="ghost" size="md" onClick={skip} data-testid="result-name-ask-skip">
          {t("result.nameAsk.skip")}
        </Button>
      </div>
    </section>
  );
}

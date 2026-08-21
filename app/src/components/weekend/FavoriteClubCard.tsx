import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, ChevronRight, Heart, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoInput } from "@/components/neo/NeoInput";
import { leagueName } from "@/lib/leagueNames";
import { friendlyError } from "@/lib/errors";

/**
 * The one place a user sets the profile-level favorite club — the club the
 * 3-per-club cap does not apply to (How to play › Club cap). Lives on the
 * weekend hub; the How-to-play text points here.
 *
 * The 28-day cooldown is the server's (lib/fantasyFavoriteClub): this card
 * only shows what the mutation returns — an immediate change when no club
 * was ever set, otherwise the old club stays in force and the new one is
 * shown as pending with its date. Hidden for anonymous visitors, who have
 * no profile to set it on.
 */
export function FavoriteClubCard() {
  const { t, i18n } = useTranslation();
  const state = useQuery(api.fantasySquads.getFavoriteClub, {});
  const setFavoriteClub = useMutation(api.fantasySquads.setFavoriteClub);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const club of state?.clubs ?? []) m.set(club.clubId, club.name);
    return (clubId: string | null) =>
      clubId === null ? null : (m.get(clubId) ?? clubId);
  }, [state]);

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byLeague = new Map<number, { clubId: string; name: string }[]>();
    for (const club of state?.clubs ?? []) {
      if (needle.length > 0 && !club.name.toLowerCase().includes(needle))
        continue;
      const list = byLeague.get(club.leagueId) ?? [];
      list.push(club);
      byLeague.set(club.leagueId, list);
    }
    return [...byLeague.entries()]
      .map(([leagueId, clubs]) => ({ leagueId, clubs }))
      .sort((a, b) =>
        leagueName(a.leagueId).localeCompare(leagueName(b.leagueId)),
      );
  }, [state, search]);

  if (state === undefined || !state.signedIn) return null;

  const inForceName = nameOf(state.inForce);
  const pendingName = nameOf(state.pending);
  const formatDate = (ms: number) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "short",
    }).format(new Date(ms));

  const choose = async (clubId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await setFavoriteClub({ clubId });
      setOpen(false);
      setSearch("");
      if (result.pending !== null && result.effectiveFrom !== null) {
        toast.success(
          t("weekend.favoriteClubQueued", {
            defaultValue: "{{club}} becomes your favorite club on {{date}}.",
            club: nameOf(result.pending),
            date: formatDate(result.effectiveFrom),
          }),
        );
      } else {
        toast.success(
          t("weekend.favoriteClubSet", {
            defaultValue: "{{club}} is your favorite club.",
            club: nameOf(result.inForce),
          }),
        );
      }
    } catch (error) {
      toast.error(
        friendlyError(
          error,
          t("weekend.favoriteClubFailed", {
            defaultValue: "Could not save your favorite club.",
          }),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <NeoCard
        shadow="lg"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 text-left"
        data-testid="weekend-favorite-club"
      >
        <div className="neo-border rounded-lg bg-destructive text-destructive-foreground p-2 shrink-0">
          <Heart size={18} strokeWidth={2.5} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-base leading-tight">
            {t("weekend.favoriteClubTitle", { defaultValue: "Favorite club" })}
            {inForceName !== null && (
              <span className="text-primary">
                {" · "}
                {inForceName}
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {pendingName !== null && state.effectiveFrom !== null
              ? t("weekend.favoriteClubPendingBody", {
                  defaultValue: "{{club}} takes over on {{date}}.",
                  club: pendingName,
                  date: formatDate(state.effectiveFrom),
                })
              : inForceName === null
                ? t("weekend.favoriteClubEmptyBody", {
                    defaultValue:
                      "Pick one — it's exempt from the 3-per-club cap.",
                  })
                : t("weekend.favoriteClubBody", {
                    defaultValue: "No club cap for them. Changes take 28 days.",
                  })}
          </p>
        </div>
        <ChevronRight
          size={18}
          strokeWidth={3}
          className="shrink-0"
          aria-hidden
        />
      </NeoCard>

      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            data-testid="favorite-club-sheet"
            aria-describedby={undefined}
            className="theme-weekend weekend-sheet-in fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm neo-border neo-shadow-lg rounded-t-xl border-b-0 bg-background text-foreground p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-3 max-h-[70dvh]"
          >
            <div className="flex items-start justify-between gap-2">
              <DialogPrimitive.Title className="font-heading font-bold text-lg">
                {t("weekend.favoriteClubTitle", {
                  defaultValue: "Favorite club",
                })}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="neo-border rounded bg-card p-1 shrink-0 active:neo-shadow-pressed"
                aria-label={t("common.close", { defaultValue: "Close" })}
              >
                <X size={14} strokeWidth={3} />
              </DialogPrimitive.Close>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("weekend.favoriteClubSheetBody", {
                defaultValue:
                  "Your first pick applies right away. Changing it later takes 28 days — the old club stays in force until then.",
              })}
            </p>
            <NeoInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="favorite-club-search"
              placeholder={t("weekend.searchClubs", {
                defaultValue: "Search clubs…",
              })}
            />
            <div className="flex flex-col gap-1 overflow-y-auto min-h-0">
              {groups.map((group) => (
                <div key={group.leagueId}>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground pt-2 pb-1">
                    {leagueName(group.leagueId)}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.clubs.map((club) => {
                      const selected =
                        club.clubId === (state.pending ?? state.inForce);
                      return (
                        <button
                          key={club.clubId}
                          type="button"
                          disabled={busy}
                          onClick={() => void choose(club.clubId)}
                          className={`flex items-center justify-between gap-2 neo-border rounded px-3 py-2 text-left font-heading font-bold text-sm active:neo-shadow-pressed ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-card"
                          }`}
                        >
                          <span className="truncate">{club.name}</span>
                          {selected && (
                            <Check
                              size={14}
                              strokeWidth={3}
                              className="shrink-0"
                              aria-hidden
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-4">
                  {t("weekend.noClubsMatch", {
                    defaultValue: "No club matches that.",
                  })}
                </p>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

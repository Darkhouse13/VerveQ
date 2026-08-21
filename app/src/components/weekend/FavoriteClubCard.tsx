import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronRight, Heart, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { leagueName } from "@/lib/leagueNames";
import { friendlyError } from "@/lib/errors";

/**
 * The one place a user sets the profile-level favorite club — the club the
 * 3-per-club cap does not apply to (How to play › Club cap). Lives on the
 * weekend hub; the How-to-play text and the builder's club-cap error point
 * here.
 *
 * Owner ruling 2026-08-21: the favorite club is PERMANENT. The server refuses
 * any change once a club is in force, so this card says so before the pick
 * (sheet warning), asks again on the chosen club (confirm step), and once set
 * renders as a locked, non-interactive row. Hidden for anonymous visitors,
 * who have no profile to set it on.
 */
export function FavoriteClubCard() {
  const { t } = useTranslation();
  const state = useQuery(api.fantasySquads.getFavoriteClub, {});
  const setFavoriteClub = useMutation(api.fantasySquads.setFavoriteClub);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [candidate, setCandidate] = useState<{
    clubId: string;
    name: string;
  } | null>(null);
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

  // A change queued under the retired cooldown still lands; until then the
  // user is locked to it just as if it were in force.
  const lockedClubId = state.pending ?? state.inForce;
  const lockedName = nameOf(lockedClubId);

  const close = () => {
    setOpen(false);
    setSearch("");
    setCandidate(null);
  };

  const confirm = async () => {
    if (busy || candidate === null) return;
    setBusy(true);
    try {
      const result = await setFavoriteClub({ clubId: candidate.clubId });
      close();
      toast.success(
        t("weekend.favoriteClubSet", {
          defaultValue: "{{club}} is your favorite club — for good.",
          club: nameOf(result.inForce) ?? candidate.name,
        }),
      );
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

  if (lockedName !== null) {
    return (
      <NeoCard
        shadow="lg"
        className="flex items-center gap-3 text-left"
        data-testid="weekend-favorite-club"
      >
        <div className="neo-border rounded-lg bg-destructive text-destructive-foreground p-2 shrink-0">
          <Heart size={18} strokeWidth={2.5} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-base leading-tight">
            {t("weekend.favoriteClubTitle", { defaultValue: "Favorite club" })}
            <span className="text-primary">
              {" · "}
              {lockedName}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {t("weekend.favoriteClubLockedBody", {
              defaultValue:
                "No club cap for them. Permanent — it can't be changed.",
            })}
          </p>
        </div>
        <Lock
          size={16}
          strokeWidth={2.5}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        />
      </NeoCard>
    );
  }

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
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {t("weekend.favoriteClubEmptyBody", {
              defaultValue:
                "Pick one — it's exempt from the 3-per-club cap. One choice, for good.",
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
          if (!next) close();
          else setOpen(true);
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
                {candidate === null
                  ? t("weekend.favoriteClubTitle", {
                      defaultValue: "Favorite club",
                    })
                  : t("weekend.favoriteClubConfirmTitle", {
                      defaultValue: "{{club}}, for good?",
                      club: candidate.name,
                    })}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="neo-border rounded bg-card p-1 shrink-0 active:neo-shadow-pressed"
                aria-label={t("common.close", { defaultValue: "Close" })}
              >
                <X size={14} strokeWidth={3} />
              </DialogPrimitive.Close>
            </div>

            {candidate === null ? (
              <>
                <p
                  className="neo-border rounded-lg bg-destructive/15 px-3 py-2 text-xs font-bold leading-snug"
                  data-testid="favorite-club-warning"
                >
                  {t("weekend.favoriteClubWarning", {
                    defaultValue:
                      "Choose carefully: your favorite club is permanent. It can never be changed — not next gameweek, not next season.",
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
                        {group.clubs.map((club) => (
                          <button
                            key={club.clubId}
                            type="button"
                            onClick={() => setCandidate(club)}
                            className="flex items-center justify-between gap-2 neo-border rounded px-3 py-2 text-left font-heading font-bold text-sm bg-card active:neo-shadow-pressed"
                          >
                            <span className="truncate">{club.name}</span>
                          </button>
                        ))}
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
              </>
            ) : (
              <>
                <p
                  className="text-sm leading-snug"
                  data-testid="favorite-club-confirm-body"
                >
                  {t("weekend.favoriteClubConfirmBody", {
                    defaultValue:
                      "You'll be able to pick any number of {{club}} players in every squad from now on. This choice is permanent and can never be changed.",
                    club: candidate.name,
                  })}
                </p>
                <div className="flex gap-2">
                  <NeoButton
                    variant="outline"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => setCandidate(null)}
                  >
                    {t("weekend.favoriteClubBack", { defaultValue: "Back" })}
                  </NeoButton>
                  <NeoButton
                    variant="primary"
                    className="flex-1"
                    disabled={busy}
                    data-testid="favorite-club-confirm"
                    onClick={() => void confirm()}
                  >
                    {t("weekend.favoriteClubConfirm", {
                      defaultValue: "Confirm, for good",
                    })}
                  </NeoButton>
                </div>
              </>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

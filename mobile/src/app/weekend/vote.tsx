import { useConvex, useMutation } from "convex/react";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton, Txt } from "@/components/ui";
import {
  CROWD_UNDO_WINDOW_MS,
  DoneCard,
  FixturePicker,
  REVEAL_BEAT_MS,
  RevealCard,
  VoteStack,
  localDayStart,
  type ConsensusReveal,
  type PickerFixture,
  type ServeResult,
  type VoteChoice,
} from "@/components/weekend/VoteViews";
import { ErrorLine, Loading, Notice, WeekendScreen, errorText } from "@/components/weekend/social";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import type { Id } from "@convex/_generated/dataModel";
import { color, font, radius, space } from "@/theme/tokens";

type Undo = { pairId: string; label: string; until: number };

export default function VoteScreen() {
  const insets = useSafeAreaInsets();
  const { ready } = useSession();
  const convex = useConvex();
  const [gate, setGate] = useState<"checking" | "closed" | "open">("checking");
  const [gw, setGw] = useState<number | null>(null);
  const [phase, setPhase] = useState<"stack" | "picker" | "done">("stack");
  const [serve, setServe] = useState<ServeResult | null>(null);
  const [reveal, setReveal] = useState<ConsensusReveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<readonly PickerFixture[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unseen, setUnseen] = useState<Set<string>>(new Set());
  const [exhaustedDone, setExhaustedDone] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);

  const serveMut = useMutation(api.fantasyCrowdVoting.servePair);
  const castMut = useMutation(api.fantasyCrowdVoting.castVote);
  const watchedMut = useMutation(api.fantasyCrowdVoting.setWatchedFixtures);
  const undoMut = useMutation(api.fantasyCrowdVoting.undoUnseen);
  const servedOnce = useRef(false);
  const keepGoing = useRef(false);
  const beat = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (beat.current) clearTimeout(beat.current);
  }, []);

  // Undo offer disappears when its window closes.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), Math.max(0, undo.until - Date.now()));
    return () => clearTimeout(t);
  }, [undo]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    convex
      .query(api.fantasyCrowdVoting.getVotingStatus, {})
      .then((status) => {
        if (cancelled) return;
        setGate(status === null ? "closed" : "open");
        setGw(status?.gwNumber ?? null);
      })
      .catch(() => !cancelled && setGate("closed"));
    return () => {
      cancelled = true;
    };
  }, [convex, ready]);

  const openPicker = useCallback(() => {
    setBusy(true);
    setPhase("picker");
    Promise.all([convex.query(api.fantasyMarket.getWeekendFixtures, {}), convex.query(api.fantasyCrowdVoting.getWatchedFixtures, {}).catch(() => null)])
      .then(([payload, watched]) => {
        setFixtures(payload?.fixtures ?? []);
        setSelected(new Set((watched?.selected ?? []) as string[]));
        setUnseen(new Set((watched?.unseen ?? []) as string[]));
      })
      .catch(() => setFixtures([]))
      .finally(() => setBusy(false));
  }, [convex]);

  const serveNext = useCallback(() => {
    setBusy(true);
    setReveal(null);
    serveMut({ dayStartAt: localDayStart() })
      .then((next) => {
        if (next.status === "needs_picker") {
          openPicker();
          return;
        }
        if (next.status === "exhausted" && next.progress.voted > 0 && !keepGoing.current) {
          setExhaustedDone(true);
          setPhase("done");
          setServe(next);
          return;
        }
        setServe(next);
        setPhase("stack");
      })
      .catch((e: unknown) => {
        setError(errorText(e, "Could not deal a pair."));
        setServe({ status: "closed" } as ServeResult);
        setPhase("stack");
      })
      .finally(() => setBusy(false));
  }, [openPicker, serveMut]);

  useEffect(() => {
    if (gate === "open" && !servedOnce.current) {
      servedOnce.current = true;
      serveNext();
    }
  }, [gate, serveNext]);

  const savePicker = () => {
    setBusy(true);
    setError(null);
    watchedMut({ fixtureIds: [...selected] as Id<"fantasyFixtures">[] })
      .then(() => serveNext())
      .catch((e: unknown) => {
        setError(errorText(e, "Could not save your games."));
        setBusy(false);
      });
  };

  const onVote = (choice: VoteChoice) => {
    if (!serve || serve.status !== "served" || busy) return;
    setBusy(true);
    setError(null);
    castMut({ pairId: serve.pairId, choice, dayStartAt: localDayStart() })
      .then((result) => {
        const offer = result?.undo ?? null;
        if (offer && offer.expiresAt > Date.now()) {
          setUndo({
            pairId: offer.pairId,
            label: offer.fixtures.map((f) => f.label).join(" · "),
            until: Math.min(offer.expiresAt, Date.now() + CROWD_UNDO_WINDOW_MS),
          });
        }
        const progress = result?.progress;
        const finished = progress !== undefined && progress.complete && !keepGoing.current;
        const advance = () => {
          if (finished) {
            setExhaustedDone(false);
            setPhase("done");
            setReveal(null);
            setBusy(false);
            return;
          }
          serveNext();
        };
        const nextReveal = result?.reveal ?? null;
        if (nextReveal === null) {
          advance();
          return;
        }
        setReveal(nextReveal);
        beat.current = setTimeout(advance, REVEAL_BEAT_MS);
      })
      .catch((e: unknown) => {
        setError(errorText(e, "That vote didn't land."));
        setBusy(false);
      });
  };

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const loading = gate === "checking" || (gate === "open" && phase === "stack" && serve === null) || (phase === "picker" && fixtures === null);

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <WeekendScreen
        title="Rate the weekend"
        eyebrow={gw ? `Gameweek ${gw}` : undefined}
        right={gate === "open" && phase === "stack" ? <IconButton icon={Plus} label="Add games" onPress={openPicker} /> : undefined}
      >
        <ErrorLine text={error} />
        {loading ? (
          <Loading />
        ) : gate === "closed" ? (
          <Notice title="No board is open right now." />
        ) : phase === "picker" ? (
          <FixturePicker fixtures={fixtures ?? []} selected={selected} unseen={unseen} busy={busy} editing={serve !== null} onToggle={toggle} onContinue={savePicker} />
        ) : phase === "done" ? (
          <DoneCard
            exhausted={exhaustedDone}
            onKeepGoing={() => {
              keepGoing.current = true;
              serveNext();
            }}
          />
        ) : reveal !== null ? (
          <RevealCard reveal={reveal} />
        ) : serve !== null ? (
          <VoteStack serve={serve} busy={busy} onVote={onVote} onEditPicker={openPicker} />
        ) : null}
        {phase === "stack" && gate === "open" ? (
          <Txt v="caption" c={color.dim} center>
            The crowd&apos;s verdict moves each score by up to ±15%
          </Txt>
        ) : null}
      </WeekendScreen>

      {undo ? (
        <View
          style={{
            position: "absolute",
            left: space.gutter,
            right: space.gutter,
            bottom: insets.bottom + space.xl,
            minHeight: 56,
            borderRadius: radius.input,
            backgroundColor: color.cream,
            paddingLeft: space.l,
            paddingRight: space.s,
            flexDirection: "row",
            alignItems: "center",
            gap: space.m,
          }}
        >
          <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: color.ink }}>{`Retired ${undo.label}`}</Text>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            onPress={() => {
              const pairId = undo.pairId;
              setUndo(null);
              void undoMut({ pairId: pairId as Id<"fantasyCrowdPairs"> })
                .catch((e: unknown) => setError(errorText(e, "Too late — that game stays retired.")));
            }}
            style={{ height: 40, paddingHorizontal: space.l, justifyContent: "center" }}
          >
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 15, color: color.ink }}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

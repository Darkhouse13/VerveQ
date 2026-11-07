import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Button, haptic } from "@/components/ui";
import { CompletedView, DraftBoardView, LobbyView, OrderRevealView, ShortlistPanel } from "@/components/weekend/DraftViews";
import { ErrorLine, Loading, Notice, UsernameGate, WeekendScreen, errorText, useClockOffset, useNeedsUsername } from "@/components/weekend/social";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import type { Id } from "@convex/_generated/dataModel";
import { space } from "@/theme/tokens";
import { guardParams, isConvexId } from "@/lib/params";

function DraftRoomScreen() {
  const { roomId: raw } = useLocalSearchParams<{ roomId: string }>();
  const roomId = String(raw ?? "");
  const { ready } = useSession();
  const needsName = useNeedsUsername();
  const room = useQuery(api.fantasyDraftRooms.getRoom, ready && !needsName ? { roomId } : "skip");
  const needsPool = room != null && (room.status === "lobby" || room.status === "drafting" || room.status === "completed");
  const pool = useQuery(api.fantasyDraftRooms.getDraftPool, needsPool ? { roomId } : "skip");
  const queue = useQuery(
    api.fantasyDraftRooms.getMyDraftQueue,
    room != null && (room.status === "lobby" || room.status === "drafting") ? { roomId: room.roomId } : "skip",
  );

  const setSeatReady = useMutation(api.fantasyDraftRooms.setSeatReady);
  const armDraft = useMutation(api.fantasyDraftRooms.armDraft);
  const makePick = useMutation(api.fantasyDraftRooms.makePick);
  const joinRoom = useMutation(api.fantasyDraftRooms.joinRoom);
  const leaveRoom = useMutation(api.fantasyDraftRooms.leaveRoom);
  const scheduleRoom = useMutation(api.fantasyDraftRooms.scheduleRoom);
  const replaceSeat = useMutation(api.fantasyDraftRooms.replaceRoomSeat);
  const setQueue = useMutation(api.fantasyDraftRooms.setMyDraftQueue);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Server clock offset only; the ticking lives in small leaf components so the
  // whole draft screen (and its player list) doesn't redraw 5×/s.
  const offset = useClockOffset(room?.serverNow ?? null);

  // Your turn: a buzz when it starts (push for when the app is closed comes with the push work).
  const notified = useRef<number | null>(null);
  const myTurn = room != null && room.turnSeatIndex !== null && room.turnSeatIndex === room.mySeatIndex;
  useEffect(() => {
    if (!room || room.currentPickIndex === null || notified.current === room.currentPickIndex) return;
    notified.current = room.currentPickIndex;
    if (myTurn) haptic.right();
  }, [room, myTurn]);

  const run = (fn: () => Promise<unknown>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void fn()
      .catch((e: unknown) => setError(errorText(e, fallback)))
      .finally(() => setBusy(false));
  };
  const saveQueue = (ids: string[]) => {
    if (!room) return;
    void setQueue({ roomId: room.roomId, playerIds: ids as Id<"fantasyPlayers">[] }).catch((e: unknown) => setError(errorText(e, "Could not save your shortlist.")));
  };

  const crewCode = room?.crew?.code ?? null;
  const back = () => (crewCode ? router.replace({ pathname: "/weekend/crew/[code]", params: { code: crewCode } }) : router.replace("/weekend/crews"));

  return (
    <WeekendScreen title={room?.crew?.name ?? "Draft room"} eyebrow={room?.gameweek ? `GW ${room.gameweek.gwNumber} draft` : undefined} onBack={back}>
      {needsName ? (
        <UsernameGate what="on the draft board" />
      ) : room === undefined ? (
        <Loading />
      ) : room === null ? (
        <Notice title="This room isn't yours to see — join the crew first." tone="bad">
          <Button label="Back to crews" variant="secondary" onPress={() => router.replace("/weekend/crews")} style={{ marginTop: space.m }} />
        </Notice>
      ) : (
        <View style={{ gap: space.xl }}>
          <ErrorLine text={error} />
          {room.status === "lobby" ? (
            <>
              <LobbyView
                room={room}
                busy={busy}
                onReady={(r) => run(() => setSeatReady({ roomId: room.roomId, ready: r }), "Could not update ready state.")}
                onClaim={() => run(() => joinRoom({ roomId: room.roomId }), "Could not claim that seat.")}
                onLeave={() => run(() => leaveRoom({ roomId: room.roomId }), "Could not release that seat.")}
                onSchedule={(at) => run(() => scheduleRoom({ roomId: room.roomId, scheduledFor: at as number /* null clears; the type snapshot is built non-strict */ }), "Could not save that draft time.")}
                onReplace={(removeUserId, addUserId) =>
                  run(
                    () => replaceSeat({ roomId: room.roomId, removeUserId: removeUserId as Id<"users">, addUserId: addUserId as Id<"users"> }),
                    "Could not replace that seat.",
                  )
                }
                onArm={() => run(() => armDraft({ roomId: room.roomId }), "Could not start the draft.")}
              />
              <ShortlistPanel pool={pool} queuedIds={queue?.playerIds ?? []} onChange={saveQueue} />
            </>
          ) : room.status === "order_reveal" ? (
            <OrderRevealView room={room} offset={offset} />
          ) : room.status === "drafting" ? (
            <DraftBoardView
              room={room}
              pool={pool}
              offset={offset}
              busy={busy}
              queuedIds={queue?.playerIds ?? []}
              onQueueChange={saveQueue}
              onPick={(playerId) =>
                run(async () => {
                  await makePick({ roomId: room.roomId, playerId: playerId as Id<"fantasyPlayers"> });
                  haptic.tap();
                }, "That pick didn't land.")
              }
            />
          ) : room.status === "completed" ? (
            <CompletedView room={room} pool={pool} onBack={back} onSheet={() => router.push({ pathname: "/weekend/sheet/[roomId]", params: { roomId: room.roomId } })} />
          ) : (
            <Notice title="This room expired before drafting." />
          )}
        </View>
      )}
    </WeekendScreen>
  );
}

export default guardParams(DraftRoomScreen, { roomId: isConvexId });

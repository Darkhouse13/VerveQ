import { useMutation, useQuery } from "convex/react";
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { UserCircle } from "phosphor-react-native/src/icons/UserCircle";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CountdownView, EndedView, FinalView, LobbyView, QuestionView, RoomBar, RoundBreakView } from "@/components/arena/RoomViews";
import { errorText, normalizeCode } from "@/components/arena/shared";
import { AppBar, Button, Card, Txt } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, space } from "@/theme/tokens";

const HEARTBEAT_MS = 15_000;

export default function ArenaRoomScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeCode(String(params.code ?? ""));
  const { ready, user } = useSession();
  const hasName = !!user?.username;

  const room = useQuery(api.challengeArenas.getRoom, ready && code.length === 6 ? { code } : "skip");
  const join = useMutation(api.challengeArenas.join);
  const leave = useMutation(api.challengeArenas.leave);
  const heartbeat = useMutation(api.challengeArenas.heartbeat);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joining = useRef(false);

  // An invite link lands here: getRoom is null until you're a player, so join once.
  useEffect(() => {
    if (!ready || !hasName || room !== null || joining.current || joinError) return;
    joining.current = true;
    join({ code })
      .catch((e) => setJoinError(errorText(e, "Couldn't join that room")))
      .finally(() => {
        joining.current = false;
      });
  }, [ready, hasName, room, code, join, joinError]);

  // Presence (docs/OPEN_BUGS.md #4): ping while this screen is focused and the app is in front.
  const arenaId = room?.arenaId;
  useFocusEffect(
    useCallback(() => {
      if (!arenaId) return;
      let appActive = AppState.currentState === "active";
      const beat = () => {
        if (appActive) void heartbeat({ arenaId }).catch(() => {});
      };
      beat();
      const id = setInterval(beat, HEARTBEAT_MS);
      const sub = AppState.addEventListener("change", (s) => {
        appActive = s === "active";
        if (appActive) beat();
      });
      return () => {
        clearInterval(id);
        sub.remove();
      };
    }, [arenaId, heartbeat]),
  );

  const me = user?._id as string | undefined;

  const onLeave = () => {
    if (!room) return router.back();
    const live = room.phase !== "lobby" && room.phase !== "final" && room.phase !== "abandoned";
    const go = () => {
      void leave({ arenaId: room.arenaId }).catch(() => {});
      router.back();
    };
    if (room.phase === "final" || room.phase === "abandoned") return router.back();
    Alert.alert(live ? "Leave the game?" : "Leave the room?", live ? "You'll drop out and your score stops here." : "You can rejoin with the code while the room is open.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: go },
    ]);
  };

  if (ready && !hasName) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Live room" eyebrow={code} onBack={() => router.back()} />
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl }}>
          <Card hero style={{ gap: space.l, alignItems: "flex-start" }}>
            <UserCircle size={40} weight="regular" color={color.cream} />
            <Txt v="cardTitle">Pick a name to join</Txt>
            <Txt c={color.muted}>{`Your friends see it in the room. Then you'll jump straight into room ${code}.`}</Txt>
            <Button label="Pick a name" style={{ alignSelf: "stretch" }} onPress={() => router.push(`/pick-name?next=${encodeURIComponent(`/arena/${code}`)}` as Href)} />
          </Card>
        </View>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Live room" eyebrow={code} onBack={() => router.back()} />
        {joinError ? (
          <EndedView title={joinError} line="Ask your friend for a fresh code, or start your own room." bottomInset={insets.bottom} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={color.lime} />
          </View>
        )}
      </View>
    );
  }

  const bottom = insets.bottom;
  let body;
  switch (room.phase) {
    case "lobby":
      body = <LobbyView room={room} me={me ?? ""} bottomInset={bottom} />;
      break;
    case "countdown":
      body = <CountdownView room={room} />;
      break;
    case "question":
    case "reveal":
      body = <QuestionView room={room} me={me ?? ""} bottomInset={bottom} />;
      break;
    case "round_break":
      body = <RoundBreakView key={`break-${room.currentRound}`} room={room} me={me ?? ""} bottomInset={bottom} />;
      break;
    case "final":
      body = <FinalView room={room} me={me ?? ""} bottomInset={bottom} />;
      break;
    default:
      body = <EndedView title="This room has ended" line="Everyone left or the room timed out." bottomInset={bottom} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <RoomBar room={room} onLeave={onLeave} />
      {body}
    </View>
  );
}

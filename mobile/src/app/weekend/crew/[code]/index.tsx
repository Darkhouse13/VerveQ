import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Bell } from "phosphor-react-native/src/icons/Bell";
import { Copy } from "phosphor-react-native/src/icons/Copy";
import { Export } from "phosphor-react-native/src/icons/Export";
import { GearSix } from "phosphor-react-native/src/icons/GearSix";
import { SignOut } from "phosphor-react-native/src/icons/SignOut";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { useEffect, useRef, useState } from "react";
import { Share, View } from "react-native";

import { Button, Card, Eyebrow, IconButton, Mono, Txt } from "@/components/ui";
import { CrewCompetition } from "@/components/weekend/CrewCompetition";
import { ErrorLine, Loading, Notice, UsernameGate, WeekendScreen, errorText, shareCrew, useNeedsUsername } from "@/components/weekend/social";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";
import { guardParams, isCode } from "@/lib/params";

function CrewScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = String(rawCode ?? "").toUpperCase();
  const { ready } = useSession();
  const needsName = useNeedsUsername();
  const live = ready && !needsName;
  const crew = useQuery(api.fantasyDraftRooms.getCrew, live ? { code } : "skip");
  const dashboard = useQuery(api.fantasyCrewDashboard.getDashboard, crew ? { code } : "skip");
  const alerts = useQuery(api.fantasyDraftRooms.getCrewAlerts, crew ? { crewId: crew.crewId } : "skip");
  const joinCrew = useMutation(api.fantasyDraftRooms.joinCrew);
  const joinRoom = useMutation(api.fantasyDraftRooms.joinRoom);
  const leaveCrew = useMutation(api.fantasyDraftRooms.leaveCrew);
  const markRead = useMutation(api.fantasyDraftRooms.markCrewAlertsRead);

  const joinAttempted = useRef(false);
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A shared crew link is an invite: try the idempotent join once.
  useEffect(() => {
    if (crew !== null || joinAttempted.current) return;
    joinAttempted.current = true;
    void joinCrew({ code }).catch((e: unknown) => setJoinFailed(errorText(e, "Could not join that crew.")));
  }, [crew, code, joinCrew]);

  if (needsName) {
    return (
      <WeekendScreen title="Crew" eyebrow="The Weekend">
        <UsernameGate what="on the draft board and the table" />
      </WeekendScreen>
    );
  }
  if (crew === undefined || (crew === null && joinFailed === null)) {
    return (
      <WeekendScreen title="Crew" eyebrow="The Weekend">
        <Loading />
      </WeekendScreen>
    );
  }
  if (crew === null) {
    return (
      <WeekendScreen title="Crew" eyebrow="The Weekend">
        <Notice title={joinFailed ?? "Could not join that crew."} tone="bad">
          <Button label="Back to crews" variant="secondary" onPress={() => router.replace("/weekend/crews")} style={{ marginTop: space.m }} />
        </Notice>
      </WeekendScreen>
    );
  }

  const isCreator = crew.createdBy === crew.isMe;
  const liveRoom = crew.rooms.find((room) => room.status !== "completed");
  const latest = alerts?.alerts[0];

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <WeekendScreen
      title={crew.name}
      eyebrow={`Crew · ${crew.members.length} members`}
      onBack={() => router.replace("/weekend/crews")}
      right={isCreator ? <IconButton icon={GearSix} label="Open Crew Command" onPress={() => router.push({ pathname: "/weekend/crew/[code]/command", params: { code } })} /> : undefined}
    >
      {/* Invite */}
      <View style={{ gap: space.m }}>
        <Eyebrow>Invite</Eyebrow>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
          <View style={{ flex: 1, gap: space.xs }}>
            <Txt v="caption" c={color.muted}>
              Invite code
            </Txt>
            <Mono s={28} style={{ letterSpacing: 4 }}>
              {crew.code}
            </Mono>
          </View>
          <IconButton icon={Copy} label="Share the code" onPress={() => void Share.share({ message: crew.code })} />
          <Button label="Share" icon={Export} onPress={() => shareCrew(crew.code)} style={{ paddingHorizontal: space.l }} />
        </Card>
      </View>

      {/* Draft */}
      <View style={{ gap: space.m }}>
        <Eyebrow>Draft</Eyebrow>
        {liveRoom !== undefined ? (
          <Card hero style={{ gap: space.l, borderColor: color.lime }}>
            <View style={{ gap: space.s }}>
              <Eyebrow c={color.lime}>{liveRoom.gameweek ? `Drafting for GW ${liveRoom.gameweek.gwNumber}` : "Drafting"}</Eyebrow>
              <Txt v="cardTitle">{liveRoom.status === "lobby" ? `${liveRoom.seatCount} of 8 seats claimed` : "Draft in progress"}</Txt>
              <Txt v="caption" c={color.muted}>
                {`Everyone drafts different players — once a player's taken, he's gone. Snake order${liveRoom.scheduledFor ? `, ${new Date(liveRoom.scheduledFor).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}` : ""}.`}
              </Txt>
            </View>
            <Button
              label={liveRoom.status === "lobby" ? "Enter the lobby" : "Enter the live draft"}
              icon={Sword}
              disabled={busy}
              onPress={() => router.push({ pathname: "/weekend/draft/[roomId]", params: { roomId: liveRoom.roomId } })}
            />
            {liveRoom.status === "lobby" ? (
              <Button
                label="Claim a draft seat"
                variant="secondary"
                disabled={busy || liveRoom.seatCount >= 8}
                onPress={() =>
                  void run(async () => {
                    await joinRoom({ roomId: liveRoom.roomId });
                    router.push({ pathname: "/weekend/draft/[roomId]", params: { roomId: liveRoom.roomId } });
                  }, "Could not claim that seat.")
                }
              />
            ) : null}
          </Card>
        ) : (
          <Notice
            title="No draft is open"
            body={isCreator ? "Open the next one from Crew Command." : "The crew creator will open the next weekend."}
          >
            {isCreator ? (
              <Button
                label="Crew Command"
                variant="secondary"
                icon={GearSix}
                onPress={() => router.push({ pathname: "/weekend/crew/[code]/command", params: { code } })}
                style={{ marginTop: space.m }}
              />
            ) : null}
          </Notice>
        )}
        <ErrorLine text={error} />
      </View>

      {/* Latest activity */}
      {alerts && latest ? (
        <View style={{ gap: space.m }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
              <Bell size={16} weight="bold" color={color.muted} />
              <Eyebrow>Latest activity</Eyebrow>
            </View>
            {alerts.unread > 0 ? (
              <Button
                label={`Mark read · ${alerts.unread}`}
                variant="ghost"
                onPress={() => void markRead({ crewId: crew.crewId })}
                style={{ height: 36, paddingHorizontal: space.s }}
              />
            ) : null}
          </View>
          <Card
            style={{ gap: space.xs, borderRadius: radius.card }}
          >
            <Txt v="rowTitle">{latest.title}</Txt>
            <Txt v="caption" c={color.muted}>
              {latest.body}
            </Txt>
            {latest.roomId !== null ? (
              <Button
                label="Open the room"
                variant="ghost"
                onPress={() => router.push({ pathname: "/weekend/draft/[roomId]", params: { roomId: String(latest.roomId) } })}
                style={{ alignSelf: "flex-start", height: 36, paddingHorizontal: 0 }}
              />
            ) : null}
          </Card>
        </View>
      ) : null}

      <CrewCompetition dashboard={dashboard} />

      {!isCreator ? (
        <Button
          label="Leave crew"
          variant="ghost"
          icon={SignOut}
          disabled={busy}
          onPress={() =>
            void run(async () => {
              joinAttempted.current = true;
              await leaveCrew({ crewId: crew.crewId });
              router.replace("/weekend/crews");
            }, "Could not leave the crew.")
          }
        />
      ) : null}
    </WeekendScreen>
  );
}

export default guardParams(CrewScreen, { code: isCode });

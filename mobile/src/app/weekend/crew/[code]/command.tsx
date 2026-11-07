import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Bell } from "phosphor-react-native/src/icons/Bell";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Copy } from "phosphor-react-native/src/icons/Copy";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Info } from "phosphor-react-native/src/icons/Info";
import { SignOut } from "phosphor-react-native/src/icons/SignOut";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { Trash } from "phosphor-react-native/src/icons/Trash";
import { UserMinus } from "phosphor-react-native/src/icons/UserMinus";
import { useState } from "react";
import { Share, View } from "react-native";

import { Button, Card, Eyebrow, IconButton, Mono, Txt } from "@/components/ui";
import { Badge, ErrorLine, Field, List, Loading, Notice, Row, Sheet, WeekendScreen, errorText, shareCrew } from "@/components/weekend/social";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import type { Id } from "@convex/_generated/dataModel";
import { color, font, space } from "@/theme/tokens";
import { guardParams, isCode } from "@/lib/params";

const ROOM_STATUS: Record<string, { label: string; tone: "warn" | "bad" | "good" | "muted" }> = {
  lobby: { label: "Lobby open", tone: "warn" },
  order_reveal: { label: "Drafting", tone: "bad" },
  drafting: { label: "Drafting", tone: "bad" },
  completed: { label: "Drafted", tone: "good" },
};

function CrewCommandScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = String(rawCode ?? "").toUpperCase();
  const { ready } = useSession();
  const crew = useQuery(api.fantasyDraftRooms.getCrew, ready ? { code } : "skip");
  const isCreator = crew != null && crew.createdBy === crew.isMe;
  const alerts = useQuery(api.fantasyDraftRooms.getCrewAlerts, crew && isCreator ? { crewId: crew.crewId } : "skip");
  const createRoom = useMutation(api.fantasyDraftRooms.createRoom);
  const deleteCrew = useMutation(api.fantasyDraftRooms.deleteCrew);
  const leaveCrew = useMutation(api.fantasyDraftRooms.leaveCrew);
  const removeMember = useMutation(api.fantasyDraftRooms.removeCrewMember);
  const markRead = useMutation(api.fantasyDraftRooms.markCrewAlertsRead);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [toRemove, setToRemove] = useState<{ userId: string; name: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const back = () => router.replace({ pathname: "/weekend/crew/[code]", params: { code } });

  if (crew === undefined) {
    return (
      <WeekendScreen title="Crew Command" onBack={back}>
        <Loading />
      </WeekendScreen>
    );
  }
  if (crew === null || !isCreator) {
    return (
      <WeekendScreen title="Crew Command" onBack={back}>
        <Notice title="Creator access only" body="Only the person running this crew can open Crew Command." tone="bad">
          <Button label="Back to crew" variant="secondary" onPress={back} style={{ marginTop: space.m }} />
        </Notice>
      </WeekendScreen>
    );
  }

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

  const liveRoom = crew.rooms.find((r) => r.status !== "completed");

  return (
    <WeekendScreen title="Crew Command" eyebrow={crew.name} onBack={back} right={<IconButton icon={Info} label="How Crew Command works" onPress={() => setInfoOpen(true)} />}>
      <ErrorLine text={error} />

      <View style={{ gap: space.m }}>
        <Eyebrow>This gameweek</Eyebrow>
        {liveRoom === undefined ? (
          <Button
            label="Open the draft room"
            icon={Sword}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const { roomId } = await createRoom({ crewId: crew.crewId });
                router.push({ pathname: "/weekend/draft/[roomId]", params: { roomId: String(roomId) } });
              }, "Could not open the draft room.")
            }
          />
        ) : (
          <Card hero style={{ borderColor: color.lime, flexDirection: "row", alignItems: "center", gap: space.m }}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Txt v="cardTitle">{liveRoom.status === "lobby" ? "Lobby is open" : "Draft in progress"}</Txt>
              <Txt v="caption" c={color.muted}>{`${liveRoom.seatCount} of 8 seats claimed`}</Txt>
            </View>
            <Button label="Manage" onPress={() => router.push({ pathname: "/weekend/draft/[roomId]", params: { roomId: liveRoom.roomId } })} style={{ paddingHorizontal: space.l }} />
          </Card>
        )}
      </View>

      <View style={{ gap: space.m }}>
        <Eyebrow>Invite</Eyebrow>
        <Card hero style={{ alignItems: "center", gap: space.l }}>
          <Mono s={32} style={{ letterSpacing: 6 }}>
            {crew.code}
          </Mono>
          <View style={{ flexDirection: "row", gap: space.m, alignSelf: "stretch" }}>
            <Button label="Share link" variant="secondary" icon={Export} style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => shareCrew(crew.code)} />
            <Button label="Send code" variant="secondary" icon={Copy} style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => void Share.share({ message: crew.code })} />
          </View>
        </Card>
      </View>

      <View style={{ gap: space.m }}>
        <Eyebrow>{`Members · ${crew.members.length}`}</Eyebrow>
        <List>
          {crew.members.map((m, i) => (
            <Row
              key={m.userId}
              last={i === crew.members.length - 1}
              title={m.name}
              right={
                m.userId === crew.isMe ? (
                  <Badge label="Creator" tone="lime" />
                ) : (
                  <IconButton icon={UserMinus} label={`Remove ${m.name}`} onPress={() => setToRemove({ userId: m.userId, name: m.name })} />
                )
              }
            />
          ))}
        </List>
        <Txt v="caption" c={color.dim}>
          Membership is unlimited. Each weekend has eight draft seats.
        </Txt>
      </View>

      {alerts && alerts.alerts.length > 0 ? (
        <View style={{ gap: space.m }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
              <Bell size={16} weight="bold" color={color.muted} />
              <Eyebrow>Activity</Eyebrow>
            </View>
            {alerts.unread > 0 ? (
              <Button label={`Mark read · ${alerts.unread}`} variant="ghost" onPress={() => void markRead({ crewId: crew.crewId })} style={{ height: 36, paddingHorizontal: space.s }} />
            ) : null}
          </View>
          <List>
            {alerts.alerts.slice(0, 5).map((a, i, arr) => (
              <Row
                key={a.alertId}
                last={i === arr.length - 1}
                title={a.title}
                line={a.body}
                onPress={a.roomId !== null ? () => router.push({ pathname: "/weekend/draft/[roomId]", params: { roomId: String(a.roomId) } }) : undefined}
              />
            ))}
          </List>
        </View>
      ) : null}

      {crew.rooms.length > 0 ? (
        <View style={{ gap: space.m }}>
          <Eyebrow>Draft rooms</Eyebrow>
          <List>
            {crew.rooms.map((room, i) => {
              const st = ROOM_STATUS[room.status] ?? { label: room.status, tone: "muted" as const };
              return (
                <Row
                  key={room.roomId}
                  last={i === crew.rooms.length - 1}
                  title={room.gameweek === null ? "Gameweek" : `GW ${room.gameweek.gwNumber} · ${room.gameweek.season}`}
                  line={`${room.seatCount} drafters`}
                  onPress={() => router.push({ pathname: "/weekend/draft/[roomId]", params: { roomId: room.roomId } })}
                  right={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                      <Badge label={st.label} tone={st.tone} />
                      <CaretRight size={20} weight="bold" color={color.dim} />
                    </View>
                  }
                />
              );
            })}
          </List>
        </View>
      ) : null}

      <View style={{ gap: space.m }}>
        <Eyebrow>Ownership</Eyebrow>
        <Card style={{ gap: space.s }}>
          <Button
            label="Leave & transfer ownership"
            variant="ghost"
            icon={SignOut}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await leaveCrew({ crewId: crew.crewId });
                router.replace("/weekend/crews");
              }, "Could not leave the crew.")
            }
          />
          {crew.canDelete ? (
            <Button
              label="Delete crew"
              variant="ghost"
              icon={Trash}
              onPress={() => {
                setConfirmText("");
                setDeleteOpen(true);
              }}
            />
          ) : null}
        </Card>
      </View>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title="How Crew Command works">
        {[
          ["Draft", "open the weekly room, then manage its time and eight seats in the lobby."],
          ["Invite", "share the permanent crew link or code."],
          ["Members", "remove inactive people without erasing past results."],
          ["Ownership", "leaving transfers control; deletion is available only before the first completed draft."],
        ].map(([label, body]) => (
          <Txt key={label} c={color.muted}>
            <Txt c={color.cream} style={{ fontFamily: font.bold }}>{`${label}: `}</Txt>
            {body}
          </Txt>
        ))}
      </Sheet>

      <Sheet open={toRemove !== null} onClose={() => setToRemove(null)} title={`Remove ${toRemove?.name ?? ""}?`}>
        <Txt c={color.muted}>They leave the crew and any unstarted lobby seat. Their past results remain.</Txt>
        <View style={{ flexDirection: "row", gap: space.m }}>
          <Button label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setToRemove(null)} />
          <Button
            label="Remove"
            style={{ flex: 1 }}
            disabled={busy}
            onPress={() => {
              const target = toRemove;
              if (!target) return;
              void run(async () => {
                await removeMember({ crewId: crew.crewId, memberUserId: target.userId as Id<"users"> });
                setToRemove(null);
              }, "Could not remove that member.");
            }}
          />
        </View>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this crew?">
        <Txt c={color.muted}>This removes the crew for everyone. It cannot be undone.</Txt>
        <Field label="Type DELETE to confirm" value={confirmText} onChangeText={setConfirmText} placeholder="DELETE" autoCapitalize="characters" />
        <Button
          label="Delete crew forever"
          icon={Trash}
          disabled={busy || confirmText.trim() !== "DELETE"}
          onPress={() =>
            void run(async () => {
              await deleteCrew({ crewId: crew.crewId });
              setDeleteOpen(false);
              router.replace("/weekend/crews");
            }, "Could not delete the crew.")
          }
        />
      </Sheet>
    </WeekendScreen>
  );
}

export default guardParams(CrewCommandScreen, { code: isCode });

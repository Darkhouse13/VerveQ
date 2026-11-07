import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { Bell } from "phosphor-react-native/src/icons/Bell";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Hash } from "phosphor-react-native/src/icons/Hash";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import { useState } from "react";
import { View } from "react-native";

import { Button, Card, Mono, Txt } from "@/components/ui";
import { Badge, ErrorLine, Field, List, Loading, Row, UsernameGate, WeekendScreen, errorText, useNeedsUsername } from "@/components/weekend/social";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";

export default function CrewsScreen() {
  const { ready } = useSession();
  const needsName = useNeedsUsername();
  const crews = useQuery(api.fantasyDraftRooms.listMyCrews, ready && !needsName ? {} : "skip");
  const createCrew = useMutation(api.fantasyDraftRooms.createCrew);
  const joinCrew = useMutation(api.fantasyDraftRooms.joinCrew);

  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = mode === "create" ? await createCrew({ name: name.trim() }) : await joinCrew({ code: code.trim() });
      setMode("idle");
      router.push({ pathname: "/weekend/crew/[code]", params: { code: res.code } });
    } catch (e) {
      setError(errorText(e, mode === "create" ? "Could not create the crew." : "Could not join that crew."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <WeekendScreen title="Crews" eyebrow="The Weekend">
      {needsName ? (
        <UsernameGate what="on the draft board and the table" />
      ) : crews === undefined ? (
        <Loading />
      ) : crews.length === 0 ? (
        <Card hero style={{ gap: space.l, borderColor: color.lime }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.tile, borderWidth: 1.5, borderColor: color.lime, alignItems: "center", justifyContent: "center" }}>
            <UsersThree size={24} weight="regular" color={color.lime} />
          </View>
          <View style={{ gap: space.s }}>
            <Txt v="cardTitle">One code, one crew, 13 picks</Txt>
            <Txt c={color.muted}>
              Start a crew, share the code, and draft a fresh squad every weekend. Unique picks — when a player&apos;s gone, he&apos;s gone.
            </Txt>
          </View>
        </Card>
      ) : (
        <List>
          {crews.map((crew, i) => (
            <Row
              key={crew.crewId}
              last={i === crews.length - 1}
              onPress={() => router.push({ pathname: "/weekend/crew/[code]", params: { code: crew.code } })}
              title={crew.name}
              line={
                <Mono s={11} c={color.muted}>
                  {`${crew.code} · ${crew.memberCount} MEMBERS${crew.scheduledFor !== null ? ` · DRAFT ${new Date(crew.scheduledFor).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase()}` : ""}`}
                </Mono>
              }
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                  {crew.liveRoomStatus !== null ? (
                    <Badge label={crew.liveRoomStatus === "drafting" ? "Drafting" : "Lobby open"} tone={crew.liveRoomStatus === "drafting" ? "bad" : "warn"} />
                  ) : crew.unreadAlerts > 0 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                      <Bell size={16} weight="fill" color={color.lime} />
                      <Mono s={13} c={color.lime}>
                        {crew.unreadAlerts}
                      </Mono>
                    </View>
                  ) : null}
                  <CaretRight size={20} weight="bold" color={color.dim} />
                </View>
              }
            />
          ))}
        </List>
      )}

      {needsName ? null : mode === "idle" ? (
        <View style={{ gap: space.m }}>
          <Button label="Create crew" icon={Plus} onPress={() => setMode("create")} />
          <Button label="Join with code" variant="secondary" icon={Hash} onPress={() => setMode("join")} />
        </View>
      ) : (
        <Card hero style={{ gap: space.l }}>
          {mode === "create" ? (
            <Field label="Name your crew" value={name} onChangeText={setName} maxLength={32} placeholder="Sunday League Legends" autoFocus />
          ) : (
            <Field
              label="Enter the crew code"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect={false}
              mono
              autoFocus
            />
          )}
          <ErrorLine text={error} />
          <View style={{ flexDirection: "row", gap: space.m }}>
            <Button label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setMode("idle")} />
            <Button
              label={mode === "create" ? "Create" : "Join"}
              style={{ flex: 1 }}
              disabled={busy || (mode === "create" ? name.trim().length < 2 : code.trim().length < 4)}
              onPress={() => void submit()}
            />
          </View>
        </Card>
      )}
    </WeekendScreen>
  );
}

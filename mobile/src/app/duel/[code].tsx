import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { NeedsNameCard, useNeedsName } from "@/components/duel/common";
import { AppBar, Button, Txt } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, space } from "@/theme/tokens";
import { guardParams, isCode } from "@/lib/params";

// Opened from https://verveq.com/duel/<code> or /s/d/<code> (App Links).
// The app always has a session, so the account path of duels.getByLinkCode
// applies (the web's guest-token path is for signed-out browsers) — it needs a
// username, like the web's UsernameRequiredRoute.
function friendly(message: string) {
  if (/expired/i.test(message)) return "This duel has expired.";
  if (/own link/i.test(message)) return "That's your own duel link — send it to a friend.";
  if (/claimed|already held|belongs/i.test(message)) return "Someone else already took this duel.";
  if (/no longer open/i.test(message)) return "This duel is already finished.";
  if (/not found/i.test(message)) return "We couldn't find this duel.";
  return "Couldn't open this duel. Try again.";
}

function DuelLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { ready, needsName } = useNeedsName();
  const getByLinkCode = useMutation(api.duels.getByLinkCode);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ready || needsName || started.current || !code) return;
    started.current = true;
    getByLinkCode({ linkCode: code })
      .then((view) => router.replace(`/duels/${view.duelId}`))
      .catch((e: unknown) => setError(friendly(e instanceof Error ? e.message : "")));
  }, [ready, needsName, code, getByLinkCode]);

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Duel" onBack={() => router.replace("/")} close />
      {needsName ? (
        <NeedsNameCard next={`/duel/${code}`} />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
          {error ? (
            <>
              <Sword size={32} weight="regular" color={color.dim} />
              <Txt c={color.muted} center>
                {error}
              </Txt>
              <Button label="Start your own duel" onPress={() => router.replace("/duels/new")} />
            </>
          ) : (
            <>
              <ActivityIndicator color={color.lime} />
              <Txt v="caption" c={color.muted}>
                Opening the duel…
              </Txt>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export default guardParams(DuelLinkScreen, { code: isCode });

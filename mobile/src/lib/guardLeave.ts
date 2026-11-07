import { useNavigation, usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

/**
 * Mid-round, Android back / the header X would otherwise just pop the screen:
 * the round stays open server-side, the leave-the-app penalty unmounts with
 * the screen, and the player could search the answer and resume. Ask first;
 * leaving applies the same forfeit as leaving the app.
 */
export function useGuardedLeave(active: boolean, onLeave: () => void, message = "Leaving ends this round.") {
  const navigation = useNavigation();
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });
  const [pending, setPending] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);

  usePreventRemove(active && pending == null, ({ data }) => {
    Alert.alert("Leave the game?", message, [
      { text: "Keep playing", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          onLeaveRef.current();
          setPending(data.action);
        },
      },
    ]);
  });

  // Prevention is off once `pending` is set; replay the blocked navigation.
  useEffect(() => {
    if (pending) navigation.dispatch(pending);
  }, [pending, navigation]);
}

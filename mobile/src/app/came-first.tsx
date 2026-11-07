import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { FullAccountGate, LoadingNote } from "@/components/quiz/QuizParts";
import { QuizRunView } from "@/components/quiz/QuizRunView";
import { RankedResult } from "@/components/quiz/RankedResult";
import { useQuizSession } from "@/components/quiz/useQuizSession";
import { useSession } from "@/lib/auth";
import { color } from "@/theme/tokens";

// The server pins Which Came First to its seeded intermediate knowledge pool
// (web: /difficulty?sport=knowledge&mode=came_first).
function Run({ onAgain }: { onAgain: () => void }) {
  const run = useQuizSession({
    sport: "knowledge",
    mode: "came_first",
    difficulty: "intermediate",
    onAbandon: () => {
      Alert.alert("Game ended", "You left the app, so this game doesn't count.");
      router.back();
    },
  });
  if (run.finish) return <RankedResult title="Which Came First" eyebrow="Ranked · Medium" finish={run.finish} total={10} onPlayAgain={onAgain} />;
  return <QuizRunView run={run} title="Which Came First" eyebrow="Medium · Knowledge" tag="Medium" cameFirst />;
}

export default function CameFirstScreen() {
  const { ready, user } = useSession();
  const [run, setRun] = useState(1);
  if (!ready) return <View style={{ flex: 1, backgroundColor: color.ink }}><LoadingNote text="Loading…" /></View>;
  if (user?.isAnonymous || user?.isGuest) return <FullAccountGate title="Which Came First" eyebrow="Ranked" />;
  return <Run key={run} onAgain={() => setRun((n) => n + 1)} />;
}

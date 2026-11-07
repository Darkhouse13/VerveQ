import { Redirect, useLocalSearchParams } from "expo-router";
import { guardParams, isCode } from "@/lib/params";

// https://verveq.com/s/d/<code> is the shared duel link (an OG card on the web).
function SharedDuelRedirect() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={`/duel/${encodeURIComponent(code)}`} />;
}

export default guardParams(SharedDuelRedirect, { code: isCode });

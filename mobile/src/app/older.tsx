import { Redirect, useLocalSearchParams } from "expo-router";
import { guardParams, isConvexId, optional } from "@/lib/params";

/** Share links: verveq.com/older?c=<challengeId> (App Links) and verveq://older open the game. */
function OlderLink() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  return <Redirect href={c ? { pathname: "/whos-older", params: { c } } : "/whos-older"} />;
}

export default guardParams(OlderLink, { c: optional(isConvexId) });

import { Redirect, useLocalSearchParams } from "expo-router";
import { guardParams, isConvexId, optional } from "@/lib/params";

/** Share links: verveq.com/letters?c=<challengeId> (App Links) and verveq://letters open the game. */
function LettersLink() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  return <Redirect href={c ? { pathname: "/missing-letters", params: { c } } : "/missing-letters"} />;
}

export default guardParams(LettersLink, { c: optional(isConvexId) });

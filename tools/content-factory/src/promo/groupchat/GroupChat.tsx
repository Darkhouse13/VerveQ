import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { GROUPCHAT_SCENES } from "./scenes";

// Promo #4 — "GROUP CHAT": the argument that never ends. Same brand language,
// a structure none of the first three touch (chat-UI escalation → hard
// verdict → the receipt) on an urgent ~138 BPM message-pop groove.
export const GroupChat: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/groupchat.wav")} />
    {SCENES.map((s) => {
      const Comp = GROUPCHAT_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);

import React from "react";
import { useCurrentFrame } from "remotion";
import { ACCENTS, COLORS, Card, FONTS, Footer, POST_W, PAD, Pill, Slide, difficultyStyle, fitSize } from "./kit";

// Quiz question post: slide 1 asks (comment A–D), slide 2 answers.
// Options arrive already shuffled by posts.mjs — the source data lists the
// correct answer first, so rendering them raw would make every answer A.
export type QuestionCardProps = {
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: string;
  explanation?: string;
  accentIndex: number;
};

export const QUESTION_SLIDES = 2;
const LETTERS = ["A", "B", "C", "D"];

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, options, correctIndex, difficulty, explanation, accentIndex }) => {
  const slide = useCurrentFrame();
  const accent = ACCENTS[accentIndex % ACCENTS.length];
  const diff = difficultyStyle(difficulty);
  const reveal = slide === 1;
  const inner = POST_W - 2 * PAD;
  const qSize = fitSize(question, inner, reveal ? 3 : 5, reveal ? [46, 42, 38, 34] : [66, 60, 54, 48, 44], 0.55);
  const optSizes = [42, 38, 34, 30];

  return (
    <Slide accent={accent} mode="DAILY QUIZ" index={slide} total={QUESTION_SLIDES}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 44, gap: reveal ? 24 : 34 }}>
        <Pill bg={diff.bg} fg={diff.fg}>{diff.label}</Pill>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: qSize, lineHeight: 1.12, letterSpacing: -1 }}>{question}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: reveal ? 14 : 20 }}>
          {options.map((opt, i) => {
            const correct = i === correctIndex;
            const bg = reveal ? (correct ? COLORS.green : COLORS.card) : COLORS.card;
            const fg = reveal && correct ? COLORS.white : COLORS.ink;
            return (
              <Card
                key={i}
                bg={bg}
                shadow={reveal && correct ? 10 : 6}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  padding: reveal ? "14px 22px" : "20px 24px",
                  opacity: reveal && !correct ? 0.45 : 1,
                  color: fg,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontWeight: 700,
                    fontSize: 32,
                    width: 58,
                    height: 58,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: reveal && correct ? COLORS.ink : accent,
                    color: reveal && correct ? COLORS.cream : COLORS.ink,
                    border: `4px solid ${COLORS.ink}`,
                    flexShrink: 0,
                  }}
                >
                  {LETTERS[i]}
                </span>
                <span style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: fitSize(opt, inner - 140, 1, optSizes, 0.58) }}>{opt}</span>
                {reveal && correct ? <span style={{ marginLeft: "auto", fontSize: 44, fontWeight: 700 }}>✓</span> : null}
              </Card>
            );
          })}
        </div>
        {reveal && explanation ? (
          <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: fitSize(explanation, inner, 4, [32, 29, 26, 23], 0.52), lineHeight: 1.35 }}>
            {explanation}
          </div>
        ) : null}
        <div style={{ flex: 1 }} />
        <Footer>
          {reveal ? "One of these every day · verveq.com" : "Comment A, B, C or D, then swipe for the answer →"}
        </Footer>
      </div>
    </Slide>
  );
};

import { describe, expect, it } from "vitest";

import { mapLiveRungToQuestion } from "@/lib/learn/useLearnSession";

describe("live Learn session mapper", () => {
  it("preserves live rung types and render payloads", () => {
    expect(
      mapLiveRungToQuestion(
        {
          questionId: "q_text",
          type: "text",
          stem: "Type a capital.",
          options: [],
        },
        "Pipeline proof",
      ),
    ).toMatchObject({
      id: "q_text",
      type: "text",
      prompt: "Type a capital.",
    });

    expect(
      mapLiveRungToQuestion(
        {
          questionId: "q_numeric",
          type: "numeric",
          stem: "How many?",
          options: [],
          unit: "countries",
          tolerance: 0,
        },
        "Pipeline proof",
      ),
    ).toMatchObject({
      id: "q_numeric",
      type: "numeric",
      unit: "countries",
      tolerance: 0,
    });

    expect(
      mapLiveRungToQuestion(
        {
          questionId: "q_order",
          type: "order",
          stem: "Order these.",
          options: [],
          items: [
            { id: "b", text: "B" },
            { id: "a", text: "A" },
          ],
        },
        "Pipeline proof",
      ),
    ).toMatchObject({
      id: "q_order",
      type: "order",
      items: [
        { id: "b", text: "B" },
        { id: "a", text: "A" },
      ],
    });
  });
});

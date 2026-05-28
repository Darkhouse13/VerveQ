import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { buildLadder } from "../convex/learnLadderBuilder";
import { guardTarget } from "./lib/deployTarget";

const NODE_ID = "geo.capitals.nonobvious";
const SUBJECT = "geography";

type SmokeResult = {
  name: string;
  ok: boolean;
  details: string;
};

type LearnLadderPayload = {
  nodeId: string;
  sessionId: Id<"learnSessions">;
  rungs: Array<{
    rungId: string;
    stem: string;
    options: string[];
  }>;
};

type SubmitResult = {
  correct: boolean;
  correctAnswer: string;
  reveal: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function deploymentUrlFromEnv() {
  const target = guardTarget({ allowLive: false });
  const value = target.convexUrl;
  assert(
    value,
    `Resolved Convex target ${target.deploymentName ?? "(unknown)"} from ${
      target.source
    }, but no Convex URL was available. Set LEARN_SMOKE_CONVEX_URL, CONVEX_URL, or VITE_CONVEX_URL.`,
  );

  const parsed = new URL(value);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  assert(
    localHosts.has(parsed.hostname) ||
      process.env.LEARN_SMOKE_ALLOW_REMOTE_DEV === "1",
    "Refusing non-local Convex target unless LEARN_SMOKE_ALLOW_REMOTE_DEV=1 is set.",
  );
  return value;
}

function forbiddenPayloadKeyPaths(value: unknown, path = "$"): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      forbiddenPayloadKeyPaths(item, `${path}[${index}]`),
    );
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) => {
      const keyPath = `${path}.${key}`;
      const directLeak =
        key === "correctAnswer" ||
        key === "reveal" ||
        key === "correctReveal" ||
        key === "distractors";
      return [
        ...(directLeak ? [keyPath] : []),
        ...forbiddenPayloadKeyPaths(nested, keyPath),
      ];
    },
  );
}

function optionSetKey(options: string[]) {
  return [...options].sort().join("\u0000");
}

async function signInAnonymous(client: ConvexHttpClient) {
  const result = (await client.action(api.auth.signIn, {
    provider: "anonymous",
    params: {},
  })) as {
    tokens?: { token: string; refreshToken?: string } | null;
  };

  const token = result.tokens?.token;
  assert(token, "Anonymous Convex Auth sign-in did not return an access token.");
  client.setAuth(token);
  return token;
}

async function runAssertion(
  results: SmokeResult[],
  name: string,
  fn: () => Promise<string>,
) {
  try {
    const details = await fn();
    results.push({ name, ok: true, details });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, details: message });
  }
}

async function main() {
  const deploymentUrl = deploymentUrlFromEnv();
  const client = new ConvexHttpClient(deploymentUrl, {
    skipConvexDeploymentUrlCheck: true,
    logger: false,
  });
  const results: SmokeResult[] = [];

  console.log(`LEARN_SMOKE_TARGET=${deploymentUrl}`);

  const authToken = await signInAnonymous(client);
  const initialProgress = (await client.query(api.learn.getSubjectProgress, {
    subject: SUBJECT,
  })) as {
    progressPct: number;
    nodes: Array<{ nodeId: string; state: string }>;
  };

  let ladder: LearnLadderPayload | null = null;
  const committedLadder = buildLadder(NODE_ID);
  const committedByChecksum = new Map(
    committedLadder.questions.map((question) => [question.checksum, question]),
  );
  const committedByOptionSet = new Map(
    committedLadder.questions.map((question) => [
      optionSetKey(question.options),
      question,
    ]),
  );

  await runAssertion(
    results,
    "1 getLearnLadder returns sanitized rungs and a sessionId",
    async () => {
      ladder = (await client.mutation(api.learn.getLearnLadder, {
        nodeId: NODE_ID,
      })) as LearnLadderPayload;

      assert(ladder.sessionId, "missing sessionId");
      assert(ladder.nodeId === NODE_ID, `unexpected nodeId ${ladder.nodeId}`);
      assert(Array.isArray(ladder.rungs), "rungs is not an array");
      assert(ladder.rungs.length > 0, "no rungs returned");

      for (const rung of ladder.rungs) {
        assert(typeof rung.rungId === "string", "rung missing rungId");
        assert(typeof rung.stem === "string" && rung.stem, "rung missing stem");
        assert(Array.isArray(rung.options), "rung missing options");
        assert(rung.options.length >= 2, "rung has too few options");
      }

      const leaks = forbiddenPayloadKeyPaths(ladder);
      assert(leaks.length === 0, `answer/reveal fields leaked at ${leaks.join(", ")}`);
      return `${ladder.rungs.length} sanitized rungs`;
    },
  );

  let wrongSubmit: SubmitResult | null = null;
  let rightSubmit: SubmitResult | null = null;

  await runAssertion(
    results,
    "2 submitLearnRung is server-authoritative for wrong and right options",
    async () => {
      assert(ladder, "ladder was not created");
      const firstRung = ladder.rungs[0];
      const committed =
        committedByChecksum.get(firstRung.rungId) ??
        committedByOptionSet.get(optionSetKey(firstRung.options));
      assert(committed, `committed rung not found for ${firstRung.rungId}`);

      const wrongOption = firstRung.options.find(
        (option) => option !== committed.correctAnswer,
      );
      assert(wrongOption, "could not find a wrong option");
      const expectedWrongReveal = committed.distractors.find(
        (distractor) => distractor.text === wrongOption,
      )?.reveal;
      assert(expectedWrongReveal, "missing committed distractor reveal");

      wrongSubmit = (await client.mutation(api.learn.submitLearnRung, {
        sessionId: ladder.sessionId,
        rungId: firstRung.rungId,
        chosenOption: wrongOption,
      })) as SubmitResult;
      assert(wrongSubmit.correct === false, "wrong option was not marked false");
      assert(
        wrongSubmit.correctAnswer === committed.correctAnswer,
        "wrong submit returned unexpected correctAnswer",
      );
      assert(
        wrongSubmit.reveal === expectedWrongReveal,
        "wrong submit returned wrong distractor-specific reveal",
      );

      rightSubmit = (await client.mutation(api.learn.submitLearnRung, {
        sessionId: ladder.sessionId,
        rungId: firstRung.rungId,
        chosenOption: committed.correctAnswer,
      })) as SubmitResult;
      assert(rightSubmit.correct === true, "right option was not marked true");
      assert(
        rightSubmit.correctAnswer === committed.correctAnswer,
        "right submit returned unexpected correctAnswer",
      );
      assert(
        rightSubmit.reveal === committed.correctReveal,
        "right submit returned wrong correct reveal",
      );

      return "wrong returned distractor reveal; right returned correct reveal";
    },
  );

  await runAssertion(
    results,
    "3 completeLearnLadder reaches proficient but same-session replay is spacing-gated",
    async () => {
      assert(ladder, "ladder was not created");
      for (const rung of ladder.rungs.slice(1)) {
        const committed =
          committedByChecksum.get(rung.rungId) ??
          committedByOptionSet.get(optionSetKey(rung.options));
        assert(committed, `committed rung not found for ${rung.rungId}`);
        await client.mutation(api.learn.submitLearnRung, {
          sessionId: ladder.sessionId,
          rungId: rung.rungId,
          chosenOption: committed.correctAnswer,
        });
      }

      const completed = (await client.mutation(api.learn.completeLearnLadder, {
        sessionId: ladder.sessionId,
      })) as {
        state: string;
        justChanged: boolean;
        reviewDueAt?: number;
        masteredAt?: number;
        firstTryCorrect: number;
        total: number;
      };
      assert(completed.state === "proficient", `state was ${completed.state}`);
      assert(completed.justChanged === true, "first completion did not change state");
      assert(
        typeof completed.reviewDueAt === "number" &&
          completed.reviewDueAt > Date.now(),
        "reviewDueAt is missing or not in the future",
      );
      assert(completed.masteredAt === undefined, "first completion mastered early");

      const replay = (await client.mutation(api.learn.completeLearnLadder, {
        sessionId: ladder.sessionId,
      })) as {
        state: string;
        justChanged: boolean;
        masteredAt?: number;
      };
      assert(replay.state !== "mastered", "same-session replay reached mastered");
      assert(replay.state === "proficient", `replay state was ${replay.state}`);
      assert(replay.justChanged === false, "same-session replay changed mastery");
      assert(replay.masteredAt === undefined, "same-session replay set masteredAt");

      return `${completed.firstTryCorrect}/${completed.total} first-try correct; reviewDueAt future`;
    },
  );

  let afterProgress:
    | {
        progressPct: number;
        nodes: Array<{ nodeId: string; state: string; reviewDue: boolean }>;
      }
    | null = null;

  await runAssertion(
    results,
    "4 getSubjectProgress reflects updated geography progress",
    async () => {
      afterProgress = (await client.query(api.learn.getSubjectProgress, {
        subject: SUBJECT,
      })) as typeof afterProgress;
      assert(afterProgress, "missing progress payload");
      assert(
        afterProgress.progressPct > initialProgress.progressPct,
        `progressPct did not move (${initialProgress.progressPct} -> ${afterProgress.progressPct})`,
      );
      const node = afterProgress.nodes.find((entry) => entry.nodeId === NODE_ID);
      assert(node, "completed node missing from subject progress");
      assert(node.state === "proficient", `node state was ${node.state}`);
      return `${initialProgress.progressPct} -> ${afterProgress.progressPct}`;
    },
  );

  await runAssertion(
    results,
    "5 getLearnNodes re-query proves mastery persisted",
    async () => {
      assert(afterProgress, "subject progress was not queried");
      const freshClient = new ConvexHttpClient(deploymentUrl, {
        skipConvexDeploymentUrlCheck: true,
        logger: false,
      });
      freshClient.setAuth(authToken);
      const nodesPayload = (await freshClient.query(api.learn.getLearnNodes, {
        subject: SUBJECT,
      })) as {
        progressPct: number;
        nodes: Array<{ nodeId: string; state: string; reviewDue: boolean }>;
      };
      const node = nodesPayload.nodes.find((entry) => entry.nodeId === NODE_ID);
      assert(node, "completed node missing from Learn nodes");
      assert(node.state === "proficient", `persisted node state was ${node.state}`);
      assert(
        nodesPayload.progressPct === afterProgress.progressPct,
        `progress mismatch (${afterProgress.progressPct} vs ${nodesPayload.progressPct})`,
      );
      return `persisted state ${node.state}`;
    },
  );

  for (const result of results) {
    console.log(
      `${result.ok ? "PASS" : "FAIL"} ${result.name} - ${result.details}`,
    );
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

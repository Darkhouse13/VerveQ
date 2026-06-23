import { describe, expect, it } from "vitest";

import {
  arenaCategoryForCieQuestion,
  cieScoreBatchRegistry,
  learnTaggedCieScoreBatches,
  type CieScoreBatchRegistryEntry,
  type CieScoreQuestion,
} from "../../convex/knowledgeCieScoreBatchRegistry";
import {
  ARENA_CIE_SPORT,
  buildArenaCieSeedPlan,
} from "../../convex/challengeArenaCieContent";
import {
  buildQuestionSkillTags,
  questionSkillTags,
  verifiedGeographyCieScoreBatches,
  verifiedHistoryCieScoreQuestions,
  verifiedLearnCieScoreBatchIds,
  verifiedLearnCieScoreQuestions,
  verifiedScienceCieScoreQuestions,
} from "../../convex/learnQuestionSkillTags";
import {
  knowledgeGeographyCieScoreBatchV1Metadata,
  knowledgeGeographyCieScoreBatchV1Questions,
} from "../../convex/knowledgeGeographyCieScoreBatchV1";
import {
  knowledgeGeographyCieScoreBatchV2Metadata,
  knowledgeGeographyCieScoreBatchV2Questions,
} from "../../convex/knowledgeGeographyCieScoreBatchV2";
import {
  knowledgeHistoryCieScoreBatchV1Metadata,
  knowledgeHistoryCieScoreBatchV1Questions,
} from "../../convex/knowledgeHistoryCieScoreBatchV1";
import {
  knowledgeScienceCieScoreBatchV1Metadata,
  knowledgeScienceCieScoreBatchV1Questions,
} from "../../convex/knowledgeScienceCieScoreBatchV1";
import { knowledgeQuestions } from "../../convex/knowledgeQuestions";

function makeQuestion(
  overrides: Partial<CieScoreQuestion> = {},
): CieScoreQuestion {
  return {
    sport: "knowledge",
    category: "chemical_element_symbols",
    question: "Synthetic CIE contract question: symbol of unobtanium?",
    options: ["Ub", "Xx", "Yy", "Zz"],
    correctAnswer: "Ub",
    difficulty: "easy",
    bucket: "knowledge_easy_chemical_element_symbols",
    checksum: "knowledge_synthetic_cie_score_v1_001",
    provenance: {
      claims: [
        {
          claim: "symbol_of(Unobtanium) = Ub",
          sourceType: "structured_open",
          sourceRef: "wikidata:QSYN:P246:snapshot-2026-06-01",
          retrievedAt: "2026-06-01",
          volatility: "static",
        },
      ],
      authorModel: "openai/gpt-5-codex",
      verifierModel: "anthropic/claude-opus-4-8",
      verdict: "agree",
      batchId: "knowledge_synthetic_cie_score_v1",
      workUnitId: "score-mode:knowledge:synthetic:static:v1",
    },
    ...overrides,
  };
}

function makeEntry(
  questions: CieScoreQuestion[],
  overrides: Partial<CieScoreBatchRegistryEntry> = {},
): CieScoreBatchRegistryEntry {
  return {
    batchModule: "knowledgeSyntheticCieScoreBatchV1",
    subject: "science",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: {
      batchId: "knowledge_synthetic_cie_score_v1",
      workUnitId: "score-mode:knowledge:synthetic:static:v1",
      authorModel: "openai/gpt-5-codex",
      verifierModel: "anthropic/claude-opus-4-8",
      verdict: "agree",
      questionCount: questions.length,
    },
    questions,
    ...overrides,
  };
}

describe("CIE score batch registry → Learn parity", () => {
  it("derives exactly the pre-registry verified geography batches", () => {
    expect(verifiedGeographyCieScoreBatches).toEqual([
      {
        batchId: knowledgeGeographyCieScoreBatchV1Metadata.batchId,
        questions: knowledgeGeographyCieScoreBatchV1Questions,
      },
      {
        batchId: knowledgeGeographyCieScoreBatchV2Metadata.batchId,
        questions: knowledgeGeographyCieScoreBatchV2Questions,
      },
    ]);
  });

  it("derives exactly the pre-registry verified history and science questions", () => {
    expect(verifiedHistoryCieScoreQuestions).toEqual(
      knowledgeHistoryCieScoreBatchV1Questions,
    );
    expect(verifiedScienceCieScoreQuestions).toEqual(
      knowledgeScienceCieScoreBatchV1Questions,
    );
  });

  it("derives exactly the pre-registry verified batch id list", () => {
    expect(verifiedLearnCieScoreBatchIds).toEqual([
      knowledgeGeographyCieScoreBatchV1Metadata.batchId,
      knowledgeGeographyCieScoreBatchV2Metadata.batchId,
      knowledgeHistoryCieScoreBatchV1Metadata.batchId,
      knowledgeScienceCieScoreBatchV1Metadata.batchId,
    ]);
  });

  it("produces identical skill tags to a direct-import recomputation", () => {
    const directQuestions = [
      ...knowledgeGeographyCieScoreBatchV1Questions,
      ...knowledgeGeographyCieScoreBatchV2Questions,
      ...knowledgeHistoryCieScoreBatchV1Questions,
      ...knowledgeScienceCieScoreBatchV1Questions,
    ];
    expect(verifiedLearnCieScoreQuestions).toEqual(directQuestions);
    expect(questionSkillTags).toEqual(buildQuestionSkillTags(directQuestions));
  });

  it("freezes the Learn tagging set to the original four batches", () => {
    expect(
      learnTaggedCieScoreBatches.map((entry) => entry.batchModule),
    ).toEqual([
      "knowledgeGeographyCieScoreBatchV1",
      "knowledgeGeographyCieScoreBatchV2",
      "knowledgeHistoryCieScoreBatchV1",
      "knowledgeScienceCieScoreBatchV1",
    ]);
  });
});

describe("CIE score batch registry integrity", () => {
  it("lists every bundled CIE score batch exactly once", () => {
    expect(cieScoreBatchRegistry).toHaveLength(24);
    const modules = cieScoreBatchRegistry.map((entry) => entry.batchModule);
    expect(new Set(modules).size).toBe(24);
    const batchIds = cieScoreBatchRegistry.map((entry) => entry.metadata.batchId);
    expect(new Set(batchIds).size).toBe(24);
  });

  it("keeps batchModule, subject and batchId consistent", () => {
    for (const entry of cieScoreBatchRegistry) {
      expect(entry.metadata.batchId).toMatch(
        new RegExp(`^knowledge_${entry.subject}_cie_score_v\\d+$`),
      );
      const subjectPascal =
        entry.subject.charAt(0).toUpperCase() + entry.subject.slice(1);
      expect(entry.batchModule).toMatch(
        new RegExp(`^knowledge${subjectPascal}CieScoreBatchV\\d+$`),
      );
      for (const question of entry.questions) {
        expect(question.checksum.startsWith(`${entry.metadata.batchId}_`)).toBe(
          true,
        );
      }
    }
  });
});

describe("Arena CIE eligibility filter (fail closed)", () => {
  it("excludes everything in a registry-ineligible batch", () => {
    const plan = buildArenaCieSeedPlan([
      makeEntry([makeQuestion()], { eligible: false }),
    ]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions).toEqual([
      {
        batchId: "knowledge_synthetic_cie_score_v1",
        checksum: "knowledge_synthetic_cie_score_v1_001",
        reason: "registry_ineligible",
      },
    ]);
  });

  it("excludes batches whose metadata verdict is not agree", () => {
    const plan = buildArenaCieSeedPlan([
      makeEntry([makeQuestion()], {
        metadata: {
          ...makeEntry([]).metadata,
          verdict: "pending",
        },
      }),
    ]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions[0]?.reason).toBe("batch_verdict_not_agree");
  });

  it("excludes questions whose provenance verdict is not agree", () => {
    const disagree = makeQuestion();
    disagree.provenance = { ...disagree.provenance, verdict: "disagree" };
    const plan = buildArenaCieSeedPlan([makeEntry([disagree])]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions[0]?.reason).toBe("question_verdict_not_agree");
  });

  it("excludes questions without a cross-family verifier", () => {
    const pending = makeQuestion();
    pending.provenance = {
      ...pending.provenance,
      verifierModel: "pending_anthropic_verification",
    };
    const plan = buildArenaCieSeedPlan([makeEntry([pending])]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions[0]?.reason).toBe("verifier_not_cross_family");
  });

  it("excludes questions with any non-static claim, even in agree batches", () => {
    const volatile = makeQuestion();
    volatile.provenance = {
      ...volatile.provenance,
      claims: [
        { ...volatile.provenance.claims[0] },
        { ...volatile.provenance.claims[0], volatility: "annual" },
      ],
    };
    const plan = buildArenaCieSeedPlan([makeEntry([volatile])]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions[0]?.reason).toBe("non_static_volatility");
  });

  it("excludes questions with no claims at all", () => {
    const claimless = makeQuestion();
    claimless.provenance = { ...claimless.provenance, claims: [] };
    const plan = buildArenaCieSeedPlan([makeEntry([claimless])]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions[0]?.reason).toBe("non_static_volatility");
  });

  it("excludes rows whose options do not contain the correct answer", () => {
    const broken = makeQuestion({
      options: ["Xx", "Yy", "Zz", "Qq"],
    });
    const plan = buildArenaCieSeedPlan([makeEntry([broken])]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions[0]?.reason).toBe("unsupported_shape");
  });

  it("excludes logo_text-shaped rows (no bundled asset path for CIE)", () => {
    const logo = makeQuestion({ questionKind: "logo_text" });
    const plan = buildArenaCieSeedPlan([makeEntry([logo])]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions[0]?.reason).toBe("unsupported_shape");
  });

  it("excludes exact normalized prompt+answer duplicates of bundled rows", () => {
    const bundled = knowledgeQuestions[0];
    const duplicate = makeQuestion({
      category: bundled.category,
      question: bundled.question,
      options: [...bundled.options],
      correctAnswer: bundled.correctAnswer,
    });
    const plan = buildArenaCieSeedPlan([makeEntry([duplicate])]);
    expect(plan.rows).toHaveLength(0);
    expect(plan.exclusions[0]?.reason).toBe("exact_duplicate_of_bundled_row");
  });

  it("accounts for every registered question as planned or excluded", () => {
    const plan = buildArenaCieSeedPlan();
    expect(plan.totals.planned + plan.totals.excluded).toBe(
      plan.totals.registeredQuestions,
    );
    expect(plan.totals.registeredQuestions).toBe(
      cieScoreBatchRegistry.reduce(
        (sum, entry) => sum + entry.questions.length,
        0,
      ),
    );
  });
});

describe("Arena CIE subject → category routing", () => {
  it("routes capital_cities rows to the capital_cities round", () => {
    const capital = makeQuestion({
      category: "capital_cities",
      bucket: "knowledge_easy_capital_cities",
      question: "Synthetic: which country has Syntheticville as its capital?",
    });
    const entry = makeEntry([capital], { subject: "geography" });
    expect(arenaCategoryForCieQuestion(entry, capital)).toBe("capital_cities");

    const plan = buildArenaCieSeedPlan([entry]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].arenaCategory).toBe("capital_cities");
    expect(plan.rows[0].seed.category).toBe("capital_cities");
  });

  it("routes which_came_first-shaped rows to the which_came_first round key", () => {
    const wcf = makeQuestion({
      category: "historical_chronology",
      questionKind: "which_came_first",
      question: "Synthetic: which came first, alpha event or beta event?",
      options: ["Alpha event", "Beta event"],
      correctAnswer: "Alpha event",
      bucket: "knowledge_easy_historical_chronology",
    });
    const entry = makeEntry([wcf], { subject: "history" });
    const plan = buildArenaCieSeedPlan([entry]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].arenaCategory).toBe("which_came_first");
    expect(plan.rows[0].seed.category).toBe("which_came_first");
    expect(plan.rows[0].seed.questionKind).toBe("which_came_first");
    // The authored category stays auditable in the bucket string.
    expect(plan.rows[0].seed.bucket).toBe("knowledge_easy_historical_chronology");
  });

  it("routes everything else to general_knowledge with category preserved", () => {
    const plan = buildArenaCieSeedPlan([makeEntry([makeQuestion()])]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].arenaCategory).toBe("general_knowledge");
    expect(plan.rows[0].seed.category).toBe("chemical_element_symbols");
  });
});

describe("Arena CIE real seed plan invariants", () => {
  const plan = buildArenaCieSeedPlan();

  it("plans a non-empty Arena pool under the dedicated sport", () => {
    expect(plan.rows.length).toBeGreaterThan(0);
    for (const row of plan.rows) {
      expect(row.seed.sport).toBe(ARENA_CIE_SPORT);
      expect(row.seed.checksum).toMatch(
        /^knowledge_(geography|history|science)_cie_score_v\d+_\d+$/,
      );
    }
  });

  it("carries full provenance in exactly the schema shape", () => {
    for (const row of plan.rows) {
      expect(Object.keys(row.seed.provenance).sort()).toEqual([
        "authorModel",
        "batchId",
        "claims",
        "verdict",
        "verifierModel",
        "workUnitId",
      ]);
      expect(row.seed.provenance.verdict).toBe("agree");
      expect(row.seed.provenance.claims.length).toBeGreaterThan(0);
      for (const claim of row.seed.provenance.claims) {
        expect(Object.keys(claim).sort()).toEqual([
          "claim",
          "retrievedAt",
          "sourceRef",
          "sourceType",
          "volatility",
        ]);
        expect(claim.volatility).toBe("static");
      }
    }
  });

  it("only excludes real rows for duplicate reasons (all batches are verified static MCQs)", () => {
    const reasons = new Set(plan.exclusions.map((exclusion) => exclusion.reason));
    for (const reason of reasons) {
      expect([
        "exact_duplicate_of_bundled_row",
        "duplicate_prompt_answer_in_plan",
      ]).toContain(reason);
    }
  });

  it("never plans two rows with the same checksum", () => {
    const checksums = plan.rows.map((row) => row.seed.checksum);
    expect(new Set(checksums).size).toBe(checksums.length);
  });
});

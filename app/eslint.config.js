import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * Answer-leak guard — in-game ambient/side panels.
 *
 * In-game "ambient" panels (the side rails and mobile strip that flank the
 * centered answering column) must only ever show *meta* state — never the
 * content a player is being tested on. Otherwise a glance at the roster or the
 * standings could spoil the question, options, hint, or answer.
 *
 * The contract: ambient panels receive a pre-sanitized, allowlisted view-model
 * (see `src/components/shell/play/ambient/types.ts`). Screens map the raw
 * question/room state down to that view-model; the panels never touch raw state.
 * This rule enforces the contract structurally — it fails if any file under
 * `play/ambient/` so much as NAMES a question-content field, whether as a member
 * access (`q.options`), a destructure (`const { answer } = …`), a typed prop
 * (`answer: string`), or a forwarded JSX prop (`<Foo options={…} />`).
 *
 * ALLOWLISTED (never flagged): timer/clock, score, lives, streak, combo, roster
 * STATUS, standings/rank, and per-player PICKS on reveal — modeled as
 * `pick`/`picks`/`outcome`/`points`, since a sanitized pick label is not the
 * question's option list. Keep the forbidden list focused on question CONTENT so
 * it never false-positives on these legit ambient fields.
 */
const LEAK_FIELDS = [
  "question",
  "questionText",
  "questionImage",
  "imageUrl",
  "options",
  "option",
  "optionLabels",
  "choices",
  "choice",
  "answer",
  "answers",
  "correctAnswer",
  "correctIndex",
  "correctOption",
  "hint",
  "hints",
  "clue",
  "clues",
  "explanation",
  "prompt",
  "solution",
  "revealText",
  "acceptedAnswers",
];
const LEAK_RE = `^(?:${LEAK_FIELDS.join("|")})$`;
const LEAK_MESSAGE =
  "Answer-leak guard: in-game ambient/side panels must not reference question " +
  "content (text, options, hints, or answers). Allowed: timer, score, lives, " +
  "streak, combo, roster status, standings, and per-player picks on reveal. Map " +
  "raw question state to the sanitized ambient view-model in the screen instead.";

const ANSWER_LEAK_GUARD = [
  // `q.options`, `room?.currentQuestion`, `data.answer`, …
  { selector: `MemberExpression[property.name=/${LEAK_RE}/]`, message: LEAK_MESSAGE },
  // `const { options, answer } = props`
  { selector: `ObjectPattern > Property[key.name=/${LEAK_RE}/]`, message: LEAK_MESSAGE },
  // Typed props that would even ACCEPT question content: `interface Props { answer: string }`
  { selector: `TSPropertySignature[key.name=/${LEAK_RE}/]`, message: LEAK_MESSAGE },
  // JSX prop forwarding question content: `<Foo options={…} />`
  { selector: `JSXAttribute[name.name=/${LEAK_RE}/]`, message: LEAK_MESSAGE },
];

export default tseslint.config(
  { ignores: ["dist", "convex/_generated/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: [
            "AuthError",
            "isLegacyVerveqEmail",
            "neoButtonVariants",
            "normalizeEmail",
            "useAuth",
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: [
      "src/test/**/*.ts",
      "src/test/**/*.tsx",
      "eslint-fixtures/**/*.ts",
      "eslint-fixtures/**/*.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          "selector": "TSTypeReference[typeName.name='Parameters']",
          "message": "Prefer explicit named testing seams (exported interfaces/types) over brittle 'Parameters<typeof ...>' inference in test code. See curatedParityFixtures.ts for a reference example."
        },
        {
          "selector": "TSTypeReference[typeName.name='ReturnType']",
          "message": "Prefer explicit named testing seams (exported interfaces/types) over brittle 'ReturnType<typeof ...>' inference in test code. See curatedParityFixtures.ts for a reference example."
        }
      ]
    }
  },
  {
    // Answer-leak guard scope: in-game ambient/side panels and their fixtures.
    // Wired into `npm run lint` (the CI gate, see .github/workflows/app.yml).
    files: [
      "src/components/shell/play/ambient/**/*.{ts,tsx}",
      "eslint-fixtures/ambientPanels/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...ANSWER_LEAK_GUARD],
    },
  }
);

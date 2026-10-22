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

/**
 * Design lockdown (VerveQ ONE P5.1).
 *
 * tailwind.config.ts REPLACES the type, radius, shadow, z-index and duration
 * scales, so an off-system value has no named class. The remaining escape
 * hatch is Tailwind's arbitrary-value syntax; these selectors close it for
 * the four the design ratchet guards: pixel font sizes `text-[13px]`, any
 * `shadow-[…]`, any `rounded-[…]` (incl. per-corner) and any `tracking-[…]`.
 *
 * Scope: the strings a class list is written in — a JSX `className` /
 * `class` attribute (plain, in `{…}`, or any string/template nested in an
 * expression there, e.g. `cn("…", on && "…")`) and the arguments of the
 * class builders `cn` / `cva` / `clsx` / `cx`. Variant prefixes (`md:`,
 * `hover:`, `!`) are covered. Proven by eslint-fixtures/designLockdown.
 */
const LOCKDOWN_CLASS_RE =
  "(^|[\\s:!\"'`])-?(text-\\[[0-9.]+(px|rem|em)\\]|shadow-\\[|rounded(-[a-z]{1,2})?-\\[|tracking-\\[)";
const LOCKDOWN_MESSAGE =
  "Design lockdown: no arbitrary text-[Npx] / shadow-[…] / rounded-[…] / tracking-[…]. " +
  "Use the named scale (text-eyebrow…text-score, rounded-sm/md/lg/full, neo-shadow*, " +
  "tracking-brand/code) from tailwind.config.ts.";
const CLASS_CONTAINERS = [
  "JSXAttribute[name.name=/^(className|class)$/]",
  "CallExpression[callee.name=/^(cn|cva|clsx|cx)$/]",
];
const DESIGN_LOCKDOWN = CLASS_CONTAINERS.flatMap((container) => [
  { selector: `${container} Literal[value=/${LOCKDOWN_CLASS_RE}/]`, message: LOCKDOWN_MESSAGE },
  { selector: `${container} TemplateElement[value.raw=/${LOCKDOWN_CLASS_RE}/]`, message: LOCKDOWN_MESSAGE },
]);

/** Test-seam rules for test code and every fixture (kept when a later block re-sets the rule). */
const TEST_SEAM_RULES = [
  {
    "selector": "TSTypeReference[typeName.name='Parameters']",
    "message": "Prefer explicit named testing seams (exported interfaces/types) over brittle 'Parameters<typeof ...>' inference in test code. See curatedParityFixtures.ts for a reference example."
  },
  {
    "selector": "TSTypeReference[typeName.name='ReturnType']",
    "message": "Prefer explicit named testing seams (exported interfaces/types) over brittle 'ReturnType<typeof ...>' inference in test code. See curatedParityFixtures.ts for a reference example."
  }
];

export default tseslint.config(
  { ignores: ["dist", "convex/_generated/**", ".ops/**", "scripts/vendor/**"] },
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
      "no-restricted-syntax": ["error", ...TEST_SEAM_RULES],
    }
  },
  {
    // Design lockdown (see DESIGN_LOCKDOWN above). Flat config REPLACES a rule's
    // options per block, so the ambient block below repeats these selectors.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/test/**"],
    rules: {
      "no-restricted-syntax": ["error", ...DESIGN_LOCKDOWN],
    },
  },
  {
    // The lockdown's proof: every violation in the fixture carries an
    // eslint-disable-next-line, and an UNUSED directive is an error here, so
    // `npm run lint` fails the moment a selector stops firing.
    files: ["eslint-fixtures/designLockdown/**/*.{ts,tsx}"],
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "no-restricted-syntax": ["error", ...TEST_SEAM_RULES, ...DESIGN_LOCKDOWN],
    },
  },
  {
    // VerveQ ONE design system: overlays and toasts go through the primitives
    // in src/components/ui (one look, one theme-carrying portal, one toast
    // position). The primitives themselves are the only importers.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**",
      "src/lib/notify.ts",
      "src/test/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "sonner",
              message: "Use notify from @/lib/notify (one themed Toaster, one position).",
            },
            {
              name: "@radix-ui/react-dialog",
              message: "Use Dialog / Sheet / ConfirmDialog / FullscreenFlow from @/components/ui.",
            },
          ],
        },
      ],
    },
  },
  {
    // Answer-leak guard scope: in-game ambient/side panels and their fixtures.
    // Wired into `npm run lint` (the CI gate, see .github/workflows/check.yml).
    // The `**/play/ambient/**` glob covers the shared ambient dir AND any new
    // per-mode ambient dir a migrated mode adds, so the guard travels with them.
    files: [
      "src/**/play/ambient/**/*.{ts,tsx}",
      "eslint-fixtures/**/ambientPanels/**/*.{ts,tsx}",
      "eslint-fixtures/ambientPanels/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...ANSWER_LEAK_GUARD, ...DESIGN_LOCKDOWN],
    },
  }
);

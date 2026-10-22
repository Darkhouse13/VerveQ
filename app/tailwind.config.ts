import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    /*
     * LOCKDOWN (VerveQ ONE P5.1). These scales REPLACE Tailwind's defaults
     * instead of extending them, so an off-system size, radius, shadow, layer
     * or duration has no class to reach for. Arbitrary values for the same
     * properties (text-[Npx], rounded-[…], shadow-[…], tracking-[…]) are ESLint
     * errors (eslint.config.js, DESIGN_LOCKDOWN), and the design ratchet
     * (scripts/designRatchet.mjs) holds every off-system pattern count at zero.
     */
    // The type scale (spec: 12px floor, eyebrow only).
    fontSize: {
      eyebrow: ["12px", { lineHeight: "16px", letterSpacing: "0.12em" }],
      meta: ["13px", { lineHeight: "18px" }],
      "body-sm": ["14px", { lineHeight: "20px" }],
      body: ["16px", { lineHeight: "24px" }],
      "title-sm": ["18px", { lineHeight: "24px" }],
      title: ["22px", { lineHeight: "28px" }],
      "title-lg": ["28px", { lineHeight: "32px" }],
      display: ["40px", { lineHeight: "44px" }],
      score: ["64px", { lineHeight: "64px" }],
    },
    // Radii from the one --radius token (8px), plus pills and square corners.
    borderRadius: {
      none: "0px",
      sm: "calc(var(--radius) - 4px)",
      md: "calc(var(--radius) - 2px)",
      lg: "var(--radius)",
      full: "9999px",
    },
    // Hard offset shadows only (the same values as .neo-shadow* in index.css).
    boxShadow: {
      none: "none",
      "neo-sm": "2px 2px 0px 0px hsl(var(--neo-shadow-color))",
      neo: "var(--neo-shadow-x) var(--neo-shadow-y) 0px 0px hsl(var(--neo-shadow-color))",
      "neo-lg": "6px 6px 0px 0px hsl(var(--neo-shadow-color))",
    },
    // Named layers. Every overlay sat on z-50 before; sheets, toasts and
    // flashes now stack in a known order.
    zIndex: {
      auto: "auto",
      0: "0",
      raised: "10",
      nav: "30",
      frame: "40",
      overlay: "50",
      sheet: "60",
      toast: "70",
    },
    transitionDuration: {
      // What a bare `transition` class uses (Tailwind's own default).
      DEFAULT: "150ms",
      press: "120ms",
      ui: "200ms",
      reveal: "400ms",
    },
    extend: {
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        body: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        "hot-pink": {
          DEFAULT: "hsl(var(--hot-pink))",
          foreground: "hsl(var(--hot-pink-foreground))",
        },
        "electric-blue": {
          DEFAULT: "hsl(var(--electric-blue))",
          foreground: "hsl(var(--electric-blue-foreground))",
        },
        yellow: {
          DEFAULT: "hsl(var(--yellow))",
          foreground: "hsl(var(--yellow-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // VerveQ ONE roles (see src/index.css). New code reaches for these.
        ink: "hsl(var(--ink))",
        cream: "hsl(var(--cream))",
        lime: "hsl(var(--lime))",
        action: {
          DEFAULT: "hsl(var(--action))",
          foreground: "hsl(var(--action-foreground))",
        },
        // Mode accent (decision 12: Career Path, Quiz, Survival, VerveGrid).
        // Replaces Tailwind's default orange scale, which nothing used.
        orange: {
          DEFAULT: "hsl(var(--orange))",
          foreground: "hsl(var(--ink))",
        },
        // Answer feedback only. Named `verdict-*` because `text-right` /
        // `bg-right` are already alignment / position utilities.
        verdict: {
          right: "hsl(var(--right))",
          wrong: "hsl(var(--wrong))",
        },
        paper: {
          DEFAULT: "hsl(var(--paper))",
          foreground: "hsl(var(--paper-foreground))",
        },
        "mode-accent": "hsl(var(--mode-accent))",
      },
      // The VERVEQ wordmark's wide tracking (components/ui/BrandMark).
      letterSpacing: {
        brand: "0.18em",
        // Room / join codes: one character per cell.
        code: "0.4em",
      },
      keyframes: {
        "badge-land": {
          "0%": { transform: "scale(0) rotate(-10deg)", opacity: "0" },
          "60%": { transform: "scale(1.2) rotate(3deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-2deg)", opacity: "1" },
        },
        "pulse-score": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
      },
      animation: {
        "badge-land": "badge-land 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "pulse-score": "pulse-score 1s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

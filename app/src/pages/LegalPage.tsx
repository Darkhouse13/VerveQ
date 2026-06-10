import { Link } from "react-router-dom";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoLogo } from "@/components/neo/NeoLogo";

type LegalKind = "privacy" | "terms";

const UPDATED = "June 10, 2026";

const copy: Record<LegalKind, { title: string; kicker: string; sections: [string, string][] }> = {
  privacy: {
    title: "Privacy Policy",
    kicker: "How VerveQ handles your game data",
    sections: [
      ["What we collect", "We collect the username you choose, account details you provide if you upgrade, gameplay events, scores, answer choices, lobby or duel participation, and basic technical data needed to keep the service secure and reliable."],
      ["How we use it", "We use this data to run quizzes, duels, arenas, leaderboards, anti-abuse checks, onboarding, support, and product analytics. We do not sell personal information."],
      ["Public gameplay surfaces", "Usernames, scores, wins, losses, ranks, and arena or duel results may appear in social or competitive surfaces when you participate in those modes."],
      ["Security and retention", "We keep data only as long as needed for the product, safety, legal, and operational reasons. We use managed infrastructure and access controls to protect production data."],
      ["Your choices", "You can play with username-only onboarding where supported, upgrade to a full account for ranked features, or contact us to request help with your account data."],
      ["Contact", "Questions about privacy can be sent to support@verveq.com."],
    ],
  },
  terms: {
    title: "Terms of Service",
    kicker: "The rules for playing VerveQ",
    sections: [
      ["Acceptance", "By using VerveQ, you agree to these terms and to fair-play rules for quizzes, duels, arenas, leaderboards, and related features."],
      ["Accounts", "You are responsible for activity under your username or account. Use accurate sign-up information when upgrading and keep credentials secure."],
      ["Fair play", "Do not cheat, exploit bugs, automate play, abuse matchmaking, harass other players, or interfere with the service. We may limit, reset, or remove access for abuse."],
      ["Content and scores", "Game questions, visuals, scoring systems, ranks, and product designs belong to VerveQ or its licensors. Scores and ranks may be corrected if bugs or abuse affect them."],
      ["Service changes", "VerveQ may change, pause, or retire features as the product evolves. Beta and launch features may be adjusted without notice."],
      ["Contact", "Questions about these terms can be sent to support@verveq.com."],
    ],
  },
};

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const page = copy[kind];
  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <Link to="/" className="w-fit" aria-label="VerveQ home">
          <NeoLogo size="md" />
        </Link>
        <NeoCard shadow="lg" className="p-6 md:p-8">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{page.kicker}</p>
          <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">{page.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>
          <div className="mt-7 space-y-6">
            {page.sections.map(([heading, body]) => (
              <section key={heading} className="space-y-2">
                <h2 className="font-heading text-lg font-bold">{heading}</h2>
                <p className="text-sm leading-6 text-foreground/85">{body}</p>
              </section>
            ))}
          </div>
        </NeoCard>
      </div>
    </main>
  );
}

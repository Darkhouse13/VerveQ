import { LegalLayout } from "./LegalLayout";

/**
 * Privacy policy for verveq.com. The statements below describe what the app
 * actually does today (username-only and full accounts, gameplay stats, IP
 * checks for anonymous onboarding, Convex hosting) — keep it in sync when the
 * data model changes.
 */
export default function PrivacyScreen() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="June 10, 2026">
      <p>
        VerveQ (&quot;we&quot;, &quot;us&quot;) is a competitive sports trivia
        platform available at verveq.com. This policy explains what information
        we collect, why we collect it, and the choices you have. We aim to
        collect the minimum we need to run the game.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> A username is all you need to
          start playing. If you upgrade to a full account we also store your
          email address, an optional display name, and a salted hash of your
          password — never the password itself.
        </li>
        <li>
          <strong>Gameplay data.</strong> Scores, answers submitted during a
          session, game results, ELO ratings, streaks, challenge and duel
          history, and questions you create in Forge. This is the substance of
          the game — leaderboards and rivalries are built from it.
        </li>
        <li>
          <strong>Anti-abuse signals.</strong> When you start username-only
          play we check your IP address to rate-limit anonymous account
          creation, and we store a random device identifier in your browser's
          local storage for the same purpose. We also record tab-switch events
          during competitive games to enforce fair play.
        </li>
        <li>
          <strong>Technical data.</strong> Standard web server logs (IP
          address, user agent, timestamps) kept for security and debugging.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your personal information.</li>
        <li>We do not show third-party advertising.</li>
        <li>
          We do not use third-party analytics or tracking cookies. The only
          browser storage we use keeps you signed in and rate-limits abuse.
        </li>
      </ul>

      <h2>How your information is used</h2>
      <p>
        We use your information to operate the game (sessions, rankings,
        multiplayer matches), to display public leaderboards (username, rating,
        and results only — never your email), to prevent cheating and abuse,
        and to maintain and improve the service.
      </p>

      <h2>Where it lives</h2>
      <p>
        VerveQ runs on Convex (convex.dev), a hosted backend platform; your
        data is stored on Convex infrastructure in the United States and our
        web servers are operated by us. Data is encrypted in transit.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Game sessions expire automatically (minutes to hours). Account data is
        kept while your account exists. Anonymous (username-only) accounts that
        never upgrade may be removed after extended inactivity. You can request
        deletion of your account and associated personal data at any time by
        emailing us; we will action it within 30 days.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (e.g. GDPR or CCPA jurisdictions), you may
        have rights to access, correct, export, or delete your personal data,
        and to object to its processing. Contact us to exercise any of these —
        we honor them for all users regardless of location.
      </p>

      <h2>Children</h2>
      <p>
        VerveQ is not directed at children under 13 (or the higher minimum age
        your country requires), and we do not knowingly collect personal data
        from them. If you believe a child has created an account, contact us
        and we will remove it.
      </p>

      <h2>Changes</h2>
      <p>
        We will update this policy as the service evolves and change the date
        above. Material changes will be announced in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions and requests: <strong>security@verveq.com</strong>
      </p>
    </LegalLayout>
  );
}

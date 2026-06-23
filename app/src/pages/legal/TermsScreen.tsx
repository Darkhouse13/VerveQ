import { LegalLayout } from "./LegalLayout";

/** Terms of service for verveq.com. */
export default function TermsScreen() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="June 10, 2026">
      <p>
        These terms govern your use of VerveQ, the competitive sports trivia
        platform at verveq.com. By creating a username or playing, you agree to
        them. If you do not agree, please do not use the service.
      </p>

      <h2>The service</h2>
      <p>
        VerveQ offers trivia game modes (solo, daily, and multiplayer),
        rankings, and community features. Username-only play is casual and
        unranked; ranked play, global leaderboards, and daily streaks require a
        full account with an email and password. We may add, change, or retire
        features as the platform evolves.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 13 years old (or the higher minimum age in your country) to use VerveQ.</li>
        <li>Keep your password confidential — you are responsible for activity on your account.</li>
        <li>One person per account. Usernames are first-come, first-served and may not impersonate others or contain offensive content; we may reclaim or rename accounts that break this.</li>
      </ul>

      <h2>Fair play</h2>
      <p>
        Competitive integrity is the point of VerveQ. You agree not to cheat —
        including looking up answers mid-game, switching tabs during timed
        competitive sessions (which the app detects and penalizes), using bots
        or automation, exploiting bugs, manipulating matchmaking or ratings, or
        creating multiple accounts to evade limits. We may reset scores or
        ratings earned unfairly.
      </p>

      <h2>Your content</h2>
      <p>
        Questions you create in Forge and other content you submit remain
        yours; you grant us a worldwide, royalty-free license to host, display,
        and use them to operate the service. Don't submit content that is
        unlawful, infringing, or abusive — we may remove content that is.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You agree not to interfere with the service (e.g. probing or
        overloading our infrastructure, scraping at scale, reverse-engineering
        non-public APIs) or to harass other players.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        We may suspend or terminate accounts that violate these terms, with the
        severity matched to the violation. You can stop using VerveQ and request
        account deletion at any time (see the Privacy Policy).
      </p>

      <h2>Intellectual property</h2>
      <p>
        The VerveQ name, design, and software are ours. Sports data and
        statistics are drawn from publicly available information; team and
        player names belong to their respective owners and are used for
        identification only. VerveQ is not affiliated with or endorsed by any
        league, club, or player.
      </p>

      <h2>Disclaimers</h2>
      <p>
        VerveQ is provided &quot;as is&quot; without warranties of any kind. We
        don't guarantee uninterrupted availability, that ratings or stats will
        never be adjusted (e.g. after a bug or cheating incident), or that any
        feature will remain available. To the maximum extent permitted by law,
        our liability for any claim arising from the service is limited to the
        amount you paid us in the preceding 12 months — currently zero, as
        VerveQ is free to play.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms; the date above reflects the latest version.
        Material changes will be announced in the app, and continuing to play
        after they take effect constitutes acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <strong>security@verveq.com</strong>
      </p>
      <p>
        General support:{" "}
        <a href="mailto:support@verveq.com">support@verveq.com</a>. Follow VerveQ
        on X:{" "}
        <a href="https://x.com/playverveq" target="_blank" rel="noreferrer noopener">
          @playverveq
        </a>
        .
      </p>
    </LegalLayout>
  );
}

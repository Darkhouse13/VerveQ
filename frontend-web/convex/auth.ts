import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTPPasswordReset } from "./authEmail";
import {
  validatePassword,
  describePasswordReason,
} from "./lib/passwordPolicy";

// Derive a username suggestion from an email address. Final uniqueness is
// handled in users.ensureProfile after signUp; this helper only guarantees
// a non-empty, safe candidate.
function deriveUsernameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const sanitized = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  return sanitized || "user";
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Anonymous,
    Password({
      // Mirror the client-side password policy so a direct Convex action
      // call can't bypass it. Convex Auth calls this for "signUp" and
      // "reset-verification" flows and throws if we throw.
      validatePasswordRequirements(password) {
        const result = validatePassword(password);
        if (!result.ok && result.reason) {
          throw new Error(describePasswordReason(result.reason));
        }
      },
      profile(params) {
        const rawEmail = typeof params.email === "string" ? params.email : "";
        const email = rawEmail.toLowerCase().trim();
        const rawDisplayName =
          typeof params.displayName === "string" ? params.displayName.trim() : "";
        const username = deriveUsernameFromEmail(email);
        return {
          email,
          username,
          displayName: rawDisplayName || undefined,
          isGuest: false,
          totalGames: 0,
        };
      },
      reset: ResendOTPPasswordReset,
    }),
  ],
});

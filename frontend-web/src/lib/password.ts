// Thin re-export so the frontend imports from a stable @/lib/password path
// while the policy itself lives under convex/lib/ as the single source of
// truth shared with the Convex Password provider's
// `validatePasswordRequirements` hook.
export {
  COMMON_PASSWORDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  validatePassword,
  describePasswordReason,
} from "../../convex/lib/passwordPolicy";
export type {
  PasswordRejectReason,
  PasswordValidationResult,
} from "../../convex/lib/passwordPolicy";

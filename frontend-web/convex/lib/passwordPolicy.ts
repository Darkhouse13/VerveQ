// Shared password policy used by both the Convex auth provider
// (`validatePasswordRequirements` hook in convex/auth.ts) and the frontend
// signup/reset UI (via src/lib/password.ts which re-exports these symbols).
//
// Pure TypeScript with no Convex or browser dependencies so it is safe to
// import from either runtime.

export const PASSWORD_MIN_LENGTH = 12;
// 72 bytes is the upper bound supported by bcrypt-family hashers. Convex
// Auth hashes with Scrypt, which does not have that limit, but we cap at 72
// characters anyway so the policy remains portable across future providers.
export const PASSWORD_MAX_LENGTH = 72;

// A small in-repo list of common leaked passwords at length >= 12, used to
// reject the most obvious choices. Not an exhaustive deny list — it exists
// to stop the easy hits like "password1234" / "qwerty123456" from getting
// through the 12-character minimum.
export const COMMON_PASSWORDS: readonly string[] = [
  "password1234",
  "password12345",
  "password123456",
  "passwordpassword",
  "passw0rdpassw0rd",
  "qwerty123456",
  "qwertyqwerty",
  "qwertyuiop12",
  "qwertyuiopasdf",
  "qwerty12345678",
  "asdfghjkl1234",
  "asdfghjkl123456",
  "zxcvbnm123456",
  "zxcvbnmqwerty",
  "1234567890ab",
  "1234567890abc",
  "12345678901234",
  "abcdefghijkl",
  "abcdefghijk1",
  "abcdefghij1234",
  "abcdefghijklmn",
  "letmein12345",
  "letmein123456",
  "letmeinletmein",
  "welcome12345",
  "welcome123456",
  "welcomewelcome",
  "welcome1welcome",
  "admin1234567",
  "admin12345678",
  "administrator1",
  "administrator12",
  "administrator123",
  "iloveyou1234",
  "iloveyou12345",
  "iloveyouiloveyou",
  "iloveyou123456",
  "monkeymonkey",
  "monkey1234567",
  "monkey12345678",
  "dragondragon",
  "dragon1234567",
  "dragon12345678",
  "master1234567",
  "master12345678",
  "mustangmustang",
  "sunshine1234",
  "sunshine12345",
  "sunshinesunshine",
  "princess1234",
  "princess12345",
  "princessprincess",
  "football1234",
  "football12345",
  "footballfootball",
  "baseball1234",
  "baseball12345",
  "baseballbaseball",
  "basketball12",
  "basketball123",
  "trustno1trustno1",
  "superman1234",
  "superman12345",
  "batman1234567",
  "batman12345678",
  "starwars1234",
  "starwars12345",
  "starwarsstarwars",
  "michaeljordan",
  "michaelmichael",
  "jennifer1234",
  "jennifer12345",
  "jordan1234567",
  "jordan12345678",
  "ashleyashley",
  "ashley1234567",
  "thomasthomas",
  "thomas1234567",
  "harleyharley",
  "harley1234567",
  "hockeyhockey",
  "hockey1234567",
  "ranger1234567",
  "rangerranger",
  "changeme1234",
  "changeme12345",
  "changemechangeme",
  "qazwsxedcrfv",
  "1qaz2wsx3edc",
  "1q2w3e4r5t6y",
  "1q2w3e4r5t6y7u",
  "qwe123qwe123",
  "qweasdzxc123",
  "qweasdzxcqwe",
  "password!123",
  "password1!@#",
  "p@ssw0rd1234",
  "p@ssw0rdp@ssw0rd",
  "abc123abc123",
  "abc1234567890",
  "11111111aaaa",
  "aaaaaaaa1234",
  "1111111111111",
  "11111111111111",
  "000000000000",
  "0000000000000",
  "00000000000000",
  "loveme1234567",
  "loveme12345678",
  "lovelylovely",
  "summer1234567",
  "summer12345678",
  "winter1234567",
  "winter12345678",
  "verveqverveq",
  "verveq1234567",
  "verveq12345678",
];

const COMMON_SET: ReadonlySet<string> = new Set(
  COMMON_PASSWORDS.map((p) => p.toLowerCase()),
);

export type PasswordRejectReason = "too-short" | "too-long" | "too-common";

// Plain object shape (not a discriminated union) so callers don't have to
// rely on TypeScript's narrowing — the project has strictNullChecks off
// and `{ ok: true } | { ok: false; reason }` does not narrow cleanly in
// that config.
export interface PasswordValidationResult {
  ok: boolean;
  reason: PasswordRejectReason | null;
}

const OK: PasswordValidationResult = { ok: true, reason: null };

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < PASSWORD_MIN_LENGTH) return { ok: false, reason: "too-short" };
  if (password.length > PASSWORD_MAX_LENGTH) return { ok: false, reason: "too-long" };
  if (COMMON_SET.has(password.toLowerCase())) return { ok: false, reason: "too-common" };
  return OK;
}

export function describePasswordReason(reason: PasswordRejectReason): string {
  switch (reason) {
    case "too-short":
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    case "too-long":
      return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
    case "too-common":
      return "That password is too common. Please choose a different one.";
  }
}

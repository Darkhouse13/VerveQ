import type { EmailConfig } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

// Convex Auth email provider used for the Password provider's `reset`
// (OTP-based password reset) flow. A 6-digit numeric code is sent via the
// Resend HTTP API and is valid for 10 minutes.
//
// Env vars read at send time from the Convex dashboard:
//   RESEND_API_KEY   required — Resend API secret
//   EMAIL_FROM       required — e.g. "VerveQ <no-reply@yourdomain.tld>"
//
// Failures throw `ConvexError({ code: "reset_unavailable" })`. Production
// Convex redacts a plain `Error`'s message before it reaches the browser —
// the client would only ever see an opaque "Server Error", which it cannot
// map to useful copy. A ConvexError's `data` is the one payload that survives
// redaction, so it is the only way to tell the client *why* the reset failed.
// The diagnostic detail (Resend status, response body) is logged server-side
// and deliberately kept out of that payload.

const OTP_LENGTH = 6;
const OTP_MAX_AGE_SECONDS = 10 * 60;

/** Client-visible payload. Must never carry internal detail. */
const RESET_UNAVAILABLE = { code: "reset_unavailable" } as const;

function generateOtp(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += (bytes[i] % 10).toString();
  }
  return out;
}

async function sendResendEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      `Resend send failed (${res.status} ${res.statusText}): ${detail.slice(0, 500)}`,
    );
    throw new ConvexError(RESET_UNAVAILABLE);
  }
}

export const ResendOTPPasswordReset: EmailConfig = {
  id: "resend-otp-password-reset",
  type: "email",
  name: "Resend OTP (password reset)",
  from: "VerveQ <no-reply@verveq.local>",
  maxAge: OTP_MAX_AGE_SECONDS,
  async generateVerificationToken() {
    return generateOtp(OTP_LENGTH);
  },
  async sendVerificationRequest({ identifier: email, token, expires }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey) {
      console.error(
        "RESEND_API_KEY is not configured on this Convex deployment — password reset email cannot be sent.",
      );
      throw new ConvexError(RESET_UNAVAILABLE);
    }
    if (!from) {
      console.error(
        "EMAIL_FROM is not configured on this Convex deployment — password reset email cannot be sent.",
      );
      throw new ConvexError(RESET_UNAVAILABLE);
    }
    const expiresAt = expires instanceof Date ? expires : new Date(expires);
    const minutesLeft = Math.max(
      1,
      Math.round((expiresAt.getTime() - Date.now()) / 60_000),
    );
    const text =
      `Your VerveQ password reset code is: ${token}\n\n` +
      `It expires in about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}. ` +
      `If you did not request a password reset, you can ignore this email.\n\n` +
      `— VerveQ`;
    await sendResendEmail({
      apiKey,
      from,
      to: email,
      subject: "Your VerveQ password reset code",
      text,
    });
  },
  options: {},
};

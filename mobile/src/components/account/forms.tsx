import { Eye } from "phosphor-react-native/src/icons/Eye";
import { EyeSlash } from "phosphor-react-native/src/icons/EyeSlash";
import { useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { Txt } from "@/components/ui";
import { color, font, radius, size, space } from "@/theme/tokens";

// Mirrors convex/lib/usernames.ts and convex/lib/passwordPolicy.ts — the server re-checks both.
export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeUsername = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
export const normalizeEmail = (v: string) => v.trim().toLowerCase();

const COMMON = new Set(["password", "12345678", "123456789", "1234567890", "qwerty123", "password1", "password123", "iloveyou", "football", "baseball", "abc12345"]);
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 72) return "Use 72 characters or fewer.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common. Pick another.";
  return null;
}

/** Convex errors arrive as "[CONVEX M(users:x)] [Request ID: …] Server Error\nUncaught Error: msg …". Keep the human part. */
export function humanError(err: unknown, fallback: string): string {
  const data = (err as { data?: unknown })?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  const raw = err instanceof Error ? err.message : "";
  if (/InvalidSecret|InvalidAccountId|Invalid password/i.test(raw)) return "Email or password is wrong.";
  if (/TooManyFailedAttempts|rate.?limit/i.test(raw)) return "Too many tries. Wait a few minutes and try again.";
  const m = raw.match(/Uncaught (?:Convex)?Error: ([^\n]+?)(?:\s+at |\n|$)/);
  if (m?.[1] && /\s/.test(m[1].trim())) return m[1].trim();
  return fallback;
}

export function Field({
  label,
  error,
  secure,
  ...input
}: TextInputProps & { label: string; error?: string | null; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.s }}>
      <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.cream }}>{label}</Text>
      <View
        style={{
          height: size.input,
          borderRadius: radius.input,
          borderWidth: 1.5,
          borderColor: error ? color.wrong : focused ? color.lime : color.line,
          backgroundColor: color.surface,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: space.l,
          gap: space.s,
        }}
      >
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={secure ? hidden : false}
          placeholderTextColor={color.dim}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={{ flex: 1, fontFamily: font.bold, fontSize: 17, color: color.cream, paddingVertical: 0 }}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Show password" : "Hide password"} hitSlop={12} onPress={() => setHidden((h) => !h)}>
            {hidden ? <Eye size={20} weight="bold" color={color.muted} /> : <EyeSlash size={20} weight="bold" color={color.muted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Txt v="caption" c={color.wrong}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={{ borderRadius: radius.tile, backgroundColor: color.wrongBg, borderWidth: 1, borderColor: color.wrong, padding: space.m }}>
      <Txt v="caption" c={color.cream}>
        {message}
      </Txt>
    </View>
  );
}

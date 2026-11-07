import * as SecureStore from "expo-secure-store";

// First-launch flag for the Welcome screen (shown once, then Play).
const KEY = "verveq.welcome.seen.v1";

export async function hasSeenWelcome(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return true; // never block the app on storage
  }
}

export function markWelcomeSeen() {
  void SecureStore.setItemAsync(KEY, "1").catch(() => undefined);
}

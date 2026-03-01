import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

interface AuthUser {
  _id: string;
  username: string;
  displayName?: string;
  isGuest: boolean;
  totalGames: number;
  avatarUrl?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (displayName: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { signIn, signOut } = useAuthActions();
  const user = useQuery(api.users.me);
  const ensureProfile = useMutation(api.users.ensureProfile);

  const isLoading = user === undefined;
  const isAuthenticated = !!user;
  const isGuest = !!user?.isGuest;

  const login = useCallback(
    async (displayName: string) => {
      const username = displayName.toLowerCase().replace(/\s+/g, "_");
      await signIn("password", {
        email: `${username}@verveq.local`,
        password: username,
        flow: "signUp",
        username,
        displayName,
      });
      await ensureProfile({ username, displayName, isGuest: false });
    },
    [signIn, ensureProfile],
  );

  const loginAsGuest = useCallback(async () => {
    await signIn("anonymous");
    const guestId = `guest_${Date.now()}`;
    await ensureProfile({
      username: guestId,
      displayName: "Guest",
      isGuest: true,
    });
  }, [signIn, ensureProfile]);

  const logout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const authUser: AuthUser | null = user
    ? {
        _id: user._id,
        username: user.username ?? "",
        displayName: user.displayName,
        isGuest: user.isGuest ?? false,
        totalGames: user.totalGames ?? 0,
        avatarUrl: user.avatarUrl,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        isAuthenticated,
        isGuest,
        isLoading,
        login,
        loginAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

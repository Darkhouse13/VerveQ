/**
 * Account-chooser contract.
 *
 * A logged-out visitor who hits a gated shell surface (Profile tab, casual
 * modes, Learn) must be offered an explicit choice — sign in, create an
 * account, or play as a guest — instead of being dropped straight onto the
 * bare username ask. The username-only ask stays reserved for the guest
 * choice and invite flows (Arena codes preserve their inline onboarding).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const navigateSpy = vi.fn();
const authContextMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: authContextMock.useAuth,
  AuthError: class AuthError extends Error {},
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
  }),
}));

import AccountChoiceScreen from "@/pages/shell/AccountChoiceScreen";
import { FullAccountRoute, freeAlternative } from "@/components/shell/ShellRouteGuards";
import { activeTabKey } from "@/lib/shellTabs";
import { COMPETE_MODE_TILES, COMPETE_KNOWLEDGE_TILES } from "@/pages/shell/competeModeTiles";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/account" element={<AccountChoiceScreen />} />
        <Route path="/profile" element={<div>PROFILE_TARGET</div>} />
        <Route path="/home" element={<div>HOME_TARGET</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountChoiceScreen", () => {
  it("offers sign-in, create-account, and guest paths with next threaded", () => {
    authContextMock.useAuth.mockReturnValue({
      accountState: "loggedOut",
      hasUsername: false,
    });
    renderAt("/account?next=%2Fprofile");

    fireEvent.click(screen.getByText("account.create"));
    expect(navigateSpy).toHaveBeenLastCalledWith(
      "/?mode=signup&next=%2Fprofile",
    );

    fireEvent.click(screen.getByText("account.signIn"));
    expect(navigateSpy).toHaveBeenLastCalledWith(
      "/?mode=signin&next=%2Fprofile",
    );

    fireEvent.click(screen.getByText("account.guest"));
    expect(navigateSpy).toHaveBeenLastCalledWith(
      "/welcome?next=%2Fprofile",
    );
  });

  // Someone already playing on a nameless session isn't told to "play as a
  // guest" — they're doing that. Same step, said truthfully.
  it("offers a nameless session 'just pick a name', not 'play as a guest'", () => {
    authContextMock.useAuth.mockReturnValue({
      accountState: "needsUsername",
      hasUsername: false,
    });
    renderAt("/account?next=%2Fcareer-path");
    expect(screen.queryByText("account.guest")).toBeNull();
    fireEvent.click(screen.getByText("account.pickName"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/welcome?next=%2Fcareer-path");
  });

  it("bounces visitors who already have a username straight to next", () => {
    authContextMock.useAuth.mockReturnValue({
      accountState: "usernameOnly",
      hasUsername: true,
    });
    renderAt("/account?next=%2Fprofile");
    expect(screen.getByText("PROFILE_TARGET")).toBeInTheDocument();
  });

  it("rejects external next targets (open redirect)", () => {
    authContextMock.useAuth.mockReturnValue({
      accountState: "usernameOnly",
      hasUsername: true,
    });
    renderAt("/account?next=%2F%2Fevil.example");
    expect(screen.getByText("HOME_TARGET")).toBeInTheDocument();
  });
});

/**
 * The ranked gate (onboarding walkthrough F5–F6): the server refuses ranked
 * Quiz/Survival runs to guests, so the gate must not promise a casual run, and
 * must offer something playable instead of a dead end.
 */
describe("FullAccountRoute gate", () => {
  function renderGate(url: string) {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="*" element={<FullAccountRoute><div>RANKED_RUN</div></FullAccountRoute>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("maps each ranked mode to its free daily, and nothing else", () => {
    expect(freeAlternative("/quiz?sport=football&difficulty=easy")).toEqual({
      to: "/daily?sport=football",
      key: "altDaily",
    });
    expect(freeAlternative("/quiz?sport=knowledge&mode=came_first")?.to).toBe("/daily?sport=knowledge");
    expect(freeAlternative("/survival?sport=football")).toEqual({ to: "/daily-survival", key: "altSurvival" });
    expect(freeAlternative("/forge")).toBeNull();
  });

  it("a guest gets Create account (in place) and today's daily, never a promised casual run", () => {
    authContextMock.useAuth.mockReturnValue({ accountState: "usernameOnly", isFullAccount: false });
    renderGate("/quiz?sport=football&difficulty=easy");
    expect(screen.queryByText("RANKED_RUN")).toBeNull();
    expect(screen.getByText("gate.title")).toBeInTheDocument();
    expect(screen.getByText("gate.bodyUpgrade")).toBeInTheDocument();

    fireEvent.click(screen.getByText("gate.cta"));
    expect(navigateSpy).toHaveBeenLastCalledWith(
      "/upgrade?next=%2Fquiz%3Fsport%3Dfootball%26difficulty%3Deasy",
    );
    fireEvent.click(screen.getByText("gate.altDaily"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/daily?sport=football");
    fireEvent.click(screen.getByText("gate.later"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/home");
  });

  it("someone without a name goes through the chooser; Survival offers Daily Survival", () => {
    authContextMock.useAuth.mockReturnValue({ accountState: "needsUsername", isFullAccount: false });
    renderGate("/survival?sport=football");
    expect(screen.getByText("gate.bodyCreate")).toBeInTheDocument();
    fireEvent.click(screen.getByText("gate.cta"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/account?next=%2Fsurvival%3Fsport%3Dfootball");
    fireEvent.click(screen.getByText("gate.altSurvival"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/daily-survival");
  });

  it("a full account plays the ranked run", () => {
    authContextMock.useAuth.mockReturnValue({ accountState: "fullAccount", isFullAccount: true });
    renderGate("/quiz?sport=football");
    expect(screen.getByText("RANKED_RUN")).toBeInTheDocument();
  });

  it("the English copy never promises a casual run or uses the old labels", () => {
    const en = JSON.parse(read("../i18n/locales/en/shell.json")) as {
      gate: Record<string, string>;
    };
    const all = Object.values(en.gate).join(" ");
    expect(all).not.toMatch(/stays casual|username-only|full account/i);
  });
});

/** One name per account state, one label for the action (walkthrough top-10 #4). */
describe("account wording", () => {
  const locales = ["en", "fr", "es"].map((lang) => ({
    lang,
    text: ["shell", "screens", "play"].map((ns) => read(`../i18n/locales/${lang}/${ns}.json`)).join("\n"),
  }));

  it("no locale labels the guest state 'username only' or asks for a 'full account'", () => {
    const banned: Record<string, RegExp> = {
      en: /username[- ]only|full account|go ranked/i,
      fr: /pseudo uniquement|compte complet/i,
      es: /solo (con )?nombre de usuario|cuenta completa/i,
    };
    for (const { lang, text } of locales) expect(text, lang).not.toMatch(banned[lang]);
  });

  it("the guest state is 'Guest' in Profile and Settings alike", () => {
    const en = JSON.parse(read("../i18n/locales/en/shell.json")) as {
      profile: Record<string, string>;
      settings: Record<string, string>;
    };
    expect(en.profile.usernameOnly).toBe("Guest");
    expect(en.settings.accountGuest).toBe("Guest");
  });
});

describe("Profile and Play polish", () => {
  it("Settings keeps the Profile tab lit (it opens from Profile)", () => {
    expect(activeTabKey("/settings")).toBe("profile");
    expect(activeTabKey("/profile")).toBe("profile");
  });

  it("Profile is a tab: no Back button, no uppercased @handle pill in its header", () => {
    const profile = read("../pages/shell/ShellProfileScreen.tsx");
    const layout = profile.slice(profile.lastIndexOf("<ShellLayout"));
    expect(layout.slice(0, layout.indexOf(">\n"))).not.toMatch(/\bback\b|onBack/);
    expect(profile).not.toMatch(/<NeoBadge[^>]*>\s*@\{handle\}/);
  });

  it("no mode tile mints the stale target=v2 param", () => {
    for (const tile of [...COMPETE_MODE_TILES, ...COMPETE_KNOWLEDGE_TILES]) {
      expect(tile.to("football")).not.toContain("target=");
    }
  });
});

describe("gating routes through the chooser (source contract)", () => {
  const guards = read("../components/shell/ShellRouteGuards.tsx");
  const app = read("../App.tsx");

  it("UsernameOnlyRoute sends logged-out visitors to the account chooser, not the username ask", () => {
    expect(guards).toMatch(
      /UsernameOnlyRoute[\s\S]{0,400}accountChoiceUrl\(next\)/,
    );
    expect(guards).not.toContain("welcomeUrl");
  });

  it("registers /account inside the shell without a username gate", () => {
    const line = app.split("\n").find((l) => l.includes('path="/account"'));
    expect(line).toBeTruthy();
    expect(line).toContain("ShellGate");
    expect(line).not.toContain("UsernameOnlyRoute");
  });

  it("keeps the inline username-only ask for Arena invites", () => {
    const arena = read("../pages/shell/play/ArenaPlayScreen.tsx");
    expect(arena).toContain("UsernameOnlyOnboarding");
  });

  it("LoginScreen honors a validated internal ?next= after sign-in", () => {
    const login = read("../pages/LoginScreen.tsx");
    expect(login).toMatch(/nextParam\.startsWith\("\/"\)/);
    expect(login).toMatch(/!nextParam\.startsWith\("\/\/"\)/);
    expect(login).toMatch(/signIn\(email, password\);\s*navigate\(nextPath \?\? "\/home"\)/);
  });
});

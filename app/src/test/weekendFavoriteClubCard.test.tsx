import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const queryResult = vi.hoisted(() => ({ value: undefined as unknown }));
const setFavoriteClub = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: () => queryResult.value,
  useMutation: () => setFavoriteClub,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: {},
    interpolation: { escapeValue: false },
  });
});

import { FavoriteClubCard } from "@/components/weekend/FavoriteClubCard";

const clubs = [
  { clubId: "c-ars", name: "Arsenal", leagueId: 39 },
  { clubId: "c-liv", name: "Liverpool", leagueId: 39 },
  { clubId: "c-rma", name: "Real Madrid", leagueId: 140 },
];

describe("FavoriteClubCard", () => {
  it("renders nothing for anonymous visitors", () => {
    queryResult.value = {
      signedIn: false,
      inForce: null,
      pending: null,
      effectiveFrom: null,
      clubs,
    };
    const { container } = render(<FavoriteClubCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the club in force and a pending change with its date", () => {
    queryResult.value = {
      signedIn: true,
      inForce: "c-ars",
      pending: "c-liv",
      effectiveFrom: Date.UTC(2026, 8, 18, 12, 0, 0),
      clubs,
    };
    render(<FavoriteClubCard />);
    const card = screen.getByTestId("weekend-favorite-club");
    expect(card).toHaveTextContent("Arsenal");
    expect(card).toHaveTextContent(/Liverpool takes over on/);
  });

  it("opens the sheet, filters by search and saves the chosen club", async () => {
    queryResult.value = {
      signedIn: true,
      inForce: null,
      pending: null,
      effectiveFrom: null,
      clubs,
    };
    setFavoriteClub.mockResolvedValue({
      inForce: "c-rma",
      pending: null,
      effectiveFrom: null,
    });
    render(<FavoriteClubCard />);
    expect(screen.getByTestId("weekend-favorite-club")).toHaveTextContent(
      /exempt from the 3-per-club cap/,
    );
    fireEvent.click(screen.getByTestId("weekend-favorite-club"));
    const sheet = await screen.findByTestId("favorite-club-sheet");
    expect(sheet).toHaveTextContent("Arsenal");
    fireEvent.change(screen.getByTestId("favorite-club-search"), {
      target: { value: "real" },
    });
    expect(sheet).not.toHaveTextContent("Arsenal");
    fireEvent.click(screen.getByRole("button", { name: "Real Madrid" }));
    await waitFor(() =>
      expect(setFavoriteClub).toHaveBeenCalledWith({ clubId: "c-rma" }),
    );
  });
});

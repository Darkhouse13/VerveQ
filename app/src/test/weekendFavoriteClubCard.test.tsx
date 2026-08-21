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
const unset = {
  signedIn: true,
  inForce: null,
  pending: null,
  effectiveFrom: null,
  clubs,
};

describe("FavoriteClubCard — one permanent choice", () => {
  it("renders nothing for anonymous visitors", () => {
    queryResult.value = { ...unset, signedIn: false };
    const { container } = render(<FavoriteClubCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("once a club is in force the card is locked: no sheet opens", () => {
    queryResult.value = { ...unset, inForce: "c-ars" };
    render(<FavoriteClubCard />);
    const card = screen.getByTestId("weekend-favorite-club");
    expect(card).toHaveTextContent("Arsenal");
    expect(card).toHaveTextContent(/can't be changed/);
    fireEvent.click(card);
    expect(screen.queryByTestId("favorite-club-sheet")).toBeNull();
  });

  it("warns that the choice is permanent BEFORE the list, then asks to confirm the pick", async () => {
    queryResult.value = unset;
    setFavoriteClub.mockResolvedValue({
      inForce: "c-rma",
      pending: null,
      effectiveFrom: null,
    });
    render(<FavoriteClubCard />);
    fireEvent.click(screen.getByTestId("weekend-favorite-club"));
    const sheet = await screen.findByTestId("favorite-club-sheet");
    expect(screen.getByTestId("favorite-club-warning")).toHaveTextContent(
      /can never be changed/,
    );

    fireEvent.change(screen.getByTestId("favorite-club-search"), {
      target: { value: "real" },
    });
    expect(sheet).not.toHaveTextContent("Arsenal");
    fireEvent.click(screen.getByRole("button", { name: "Real Madrid" }));

    // Tapping a club does NOT save yet — the confirm step stands between.
    expect(setFavoriteClub).not.toHaveBeenCalled();
    expect(screen.getByTestId("favorite-club-confirm-body")).toHaveTextContent(
      /Real Madrid/,
    );
    expect(screen.getByTestId("favorite-club-confirm-body")).toHaveTextContent(
      /permanent/,
    );

    // Back returns to the list without saving.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("favorite-club-search")).toBeInTheDocument();
    expect(setFavoriteClub).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Real Madrid" }));
    fireEvent.click(screen.getByTestId("favorite-club-confirm"));
    await waitFor(() =>
      expect(setFavoriteClub).toHaveBeenCalledWith({ clubId: "c-rma" }),
    );
  });
});

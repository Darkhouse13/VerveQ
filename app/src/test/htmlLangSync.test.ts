import { describe, expect, it } from "vitest";
import i18n from "@/i18n";

describe("<html lang> follows the UI language", () => {
  it("updates on language change", async () => {
    await i18n.changeLanguage("fr");
    expect(document.documentElement.lang).toBe("fr");
    await i18n.changeLanguage("es");
    expect(document.documentElement.lang).toBe("es");
    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("leaves static SEO pages' server-set lang alone", async () => {
    const seo = document.createElement("div");
    seo.id = "seo";
    document.body.appendChild(seo);
    document.documentElement.lang = "fr";
    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("fr");
    seo.remove();
  });
});

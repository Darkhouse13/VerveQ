// English clue templates, same keys and text as the web (app/src/i18n/locales/en/play.json survival.hintBody).
export type ClueI18n = { key: string; vars: Record<string, string | number> };

const TEMPLATES: Record<string, string> = {
  fmNationalityPosition: "Nationality: {{nationality}} | Position: {{position}}",
  fmPlayedFor: "Played for {{club}} ({{era}})",
  fmPlayedForTeam: "Played for {{team}}",
  fmNationality: "Nationality: {{nationality}}",
  fmHandednessRank: "Plays: {{handedness}} | Highest rank: #{{rank}}",
  fmFirstName: "First name: {{firstName}}",
  fbNoPlayer: "A well-known {{sport}} player fits these initials.",
  fbFirstNameLen: "First name has {{length}} letters.",
  fbLastNameInitial: "Last name starts with {{initial}}.",
};

const SPORT_NAMES: Record<string, string> = { football: "football", basketball: "NBA", tennis: "tennis" };

export function clueText(clue: ClueI18n): string {
  const template = TEMPLATES[clue.key];
  if (!template) return Object.values(clue.vars).join(" · ");
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = clue.vars[name];
    if (value == null) return "";
    return name === "sport" ? (SPORT_NAMES[String(value)] ?? String(value)) : String(value);
  });
}

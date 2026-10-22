/**
 * THE WEEKEND — the short position label (GK/DEF/MID/ATT) in the player's
 * language: `shell:weekend.role*` (fr GB/DEF/MIL/ATT, es POR/DEF/MED/DEL).
 * The stored role codes stay English; only the label a player reads changes.
 */
const ROLE_KEYS: Record<string, string> = {
  GK: "weekend.roleGk",
  DEF: "weekend.roleDef",
  MID: "weekend.roleMid",
  ATT: "weekend.roleAtt",
};

type RoleT = (key: string, options: { defaultValue: string }) => string;

export function roleLabel(role: string, t: RoleT): string {
  const key = ROLE_KEYS[role];
  return key ? t(key, { defaultValue: role }) : role;
}

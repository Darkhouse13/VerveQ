import { describe, expect, it } from "vitest";
import { claimUsernameForUser } from "../../convex/lib/usernames";

type Row = Record<string, unknown> & { _id: string };

function makeClaimDb() {
  const users: Row[] = [
    { _id: "user_a" },
    { _id: "user_b" },
  ];
  const claims: Row[] = [];
  let nextClaim = 1;

  const filterRows = (table: string, field: string, value: unknown) => {
    const rows = table === "usernameClaims" ? claims : users;
    return rows.filter((row) => row[field] === value);
  };

  return {
    claims,
    ctx: {
      db: {
        query: (table: string) => ({
          withIndex: (
            _indexName: string,
            builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
          ) => {
            let field = "";
            let value: unknown;
            builder({
              eq: (nextField, nextValue) => {
                field = nextField;
                value = nextValue;
                return {};
              },
            });
            return {
              collect: async () => filterRows(table, field, value),
              first: async () => filterRows(table, field, value)[0] ?? null,
            };
          },
          collect: async () => (table === "usernameClaims" ? claims : users),
        }),
        insert: async (table: string, row: Record<string, unknown>) => {
          if (table !== "usernameClaims") throw new Error(`Unexpected table: ${table}`);
          if (
            claims.some(
              (claim) => claim.key === row.key && claim.releasedAt === undefined,
            )
          ) {
            throw new Error("Username is already taken. Choose another one.");
          }
          const id = `claim_${nextClaim++}`;
          claims.push({ _id: id, ...row });
          return id;
        },
      },
    },
  };
}

describe("username claim hardening", () => {
  it("lets exactly one concurrent claimant win a normalized username", async () => {
    const { ctx, claims } = makeClaimDb();

    const results = await Promise.allSettled([
      claimUsernameForUser(ctx as never, "DarkHouse13", "user_a" as never),
      claimUsernameForUser(ctx as never, "darkhouse13", "user_b" as never),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({
      key: "darkhouse13",
      username: "darkhouse13",
    });
  });
});

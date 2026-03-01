import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Anonymous,
    Password({
      profile(params) {
        return {
          username: params.username as string,
          displayName:
            (params.displayName as string) || (params.username as string),
          isGuest: false,
          totalGames: 0,
        };
      },
    }),
  ],
});

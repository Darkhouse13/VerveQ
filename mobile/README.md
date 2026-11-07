# VerveQ — Android app

Expo (SDK 58, expo-router) app on the same Convex backend as the web app in `../app`.

- `npm start` — dev server. `.env` sets `EXPO_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_SITE_URL` (DEV).
- `npm run convex-types` — refresh the typed API snapshot from `../app/convex` (`.convex-types/`, path alias `@convex/*`).
- `npx tsc --noEmit` and `npx expo lint --no-cache` must stay clean.
- Builds: `eas build --profile preview --platform android` (APK, DEV backend); `production` builds an AAB against PROD.

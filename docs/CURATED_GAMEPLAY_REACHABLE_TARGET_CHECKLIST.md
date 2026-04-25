# Curated Gameplay Reachable-Target Checklist

Use this checklist after backend deploy/seed is already in place.

## Serve the reachable target

```bash
cd frontend-web
npm run build
npx serve -s dist -l 3000
```

This serves a production bundle locally against the configured dev Convex backend.

## Higher or Lower

- Open `/sport-select?mode=higher-lower`
- Verify only football is shown
- Open `/higher-lower?sport=football`
- Verify a round starts normally
- Open `/higher-lower?sport=basketball`
- Verify the unsupported-sport state is visible
- Simulate startup failure and verify the visible recovery state appears instead of an infinite loader

## VerveGrid

- Open `/sport-select?mode=verve-grid`
- Verify only football is shown
- Open `/verve-grid?sport=football`
- Verify a grid starts normally
- Open `/verve-grid?sport=basketball`
- Verify the unsupported-sport state is visible
- Simulate startup failure and verify the visible recovery state appears instead of an infinite loader

## Who Am I

- Open `/sport-select?mode=who-am-i`
- Verify only football is shown
- Open `/who-am-i?sport=football`
- Verify a clue round starts normally
- Open `/who-am-i?sport=basketball`
- Verify the unsupported-sport state is visible
- Simulate startup failure and verify the visible recovery state appears instead of an infinite loader

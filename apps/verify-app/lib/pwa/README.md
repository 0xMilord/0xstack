

<!-- AUTO-GENERATED START -->
# `lib/pwa`

## Push + service worker runbook
- Generate VAPID keys and set:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (mailto: or URL)

## Service worker update strategy
- Increment `SW_VERSION` in `public/sw.js` when changing caching rules.
- Clients activate new SW on refresh (current implementation uses `skipWaiting` + `clients.claim`).

## Entry points (detected)

- `offline-storage.ts`
- `push.ts`
- `register-sw.client.ts`
<!-- AUTO-GENERATED END -->

---
"@0xstack/0xstack": patch
---

Generation now writes explicit routes under app/app/_ instead of app/app/(workspace)/_ | Org “workspace gating” still exists, but it’s now enforced in app/app/page.tsx (and other pages already gate via loaders/cookies) rather than via a (workspace) layout.

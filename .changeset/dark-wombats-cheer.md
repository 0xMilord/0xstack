---
"0xstack": patch
---

Expanded the SEO module to generate stronger sitewide and per-page metadata with canonical URLs plus Open Graph/Twitter defaults, added richer JSON-LD utilities (safe JSON-LD serialization plus Organization and WebSite generators), and updated the SEO activation to idempotently patch app/layout.tsx to export metadata and inject sitewide JSON-LD scripts; additionally, updated the UI foundation and billing modules so key marketing and billing pages (/, /about, /contact, /terms, /privacy, /pricing, /billing/success, /billing/cancel) ship explicit rich preview metadata instead of relying on generic defaults, while keeping the global OG/Twitter image routes intact.

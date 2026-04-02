# 0xstack Product Roadmap

0xstack is a **Production-Grade Next.js Architecture Factory**. Our mission is to provide developers with the "Gold Standard" baseline for high-velocity application development. By combining strict architectural enforcement with progressive module activation, 0xstack ensures your project scales from MVP to Enterprise without the usual technical debt.

---

## Core Architectural Principles

- **Standardized "Flat" Project Structure**: Optimized for readability and search. Next.js routes live in `app/`, and all business logic, models, and services live in `lib/`. No confusing nested groups or `src/` directories.
- **Unified Identity Backbone**: Native support for **Better Auth** with text-based User IDs to ensure a future-proof, easy-to-map data model across all services.
- **Strict I/O Boundaries**:
  - **Internal Data Writes**: Handled via secure **Server Actions** (`lib/actions/*`).
  - **External Integrations**: Gated through versioned **API Routes** (`app/api/v1/*`).
- **Progressive Activation**: Modules are only "activated" when needed. If a feature (like Billing or Blog) is disabled, it ships **no routes** and zero runtime overhead.
- **Self-Healing Ecosystem**: Built-in CLI commands like `doctor`, `baseline`, and `docs sync` work together to prevent architectural drift and maintenance debt.
- **Automated Living Documentation**: Markers-based regeneration of `ERD.md` and `ARCHITECTURE.md` ensures your documentation always reflects the reality of your code.

---

## The 0xstack Platform Backbone

Our engine is built on two core primitives: **Autonomous Scaffolding** and **Continuous Governance**.

### Phase 1: The Core Execution Engine
- **Deterministic Pipeline Engine**: Every change (installation, activation, or audit) runs through a structured, multi-step pipeline for predictable results.
- **Config-Driven Architecture**: A centralized `0xstack.config.ts` acts as the single source of truth for the entire repo layout and active modules.
- **AST-Aware Scaffolding**: Uses intelligent code transformations rather than simple text replacement to ensure safe, idempotent merges during updates.

### Phase 2: High-Velocity Productivity
- **Modular Plugin System**: A standardized lifecycle (`install / activate / sync`) that enables complex features like Billing or SEO without the manual overhead.
- **Intelligent Generators**: Automate the creation of entire domains (Schema → Repo → Loader → UI) with built-in architectural boundary checks.
- **Comprehensive Runtime Hygiene**: Commands like `doctor` and `sync` ensure your project continues to adhere to the core principles (strict boundaries, security, and schema matching) long after you’ve shipped.

---

## The 0xstack Standard (Quality Gates)

We define "Production Ready" by strict adherence to these platform guarantees:

- **Zero-Drift Architecture**: The system enforces boundaries via CLI Static Analysis, ensuring no prohibited imports (e.g., direct DB access from UI components) exist in the project and failing builds when rules are breached.
- **Enterprise-Grade Security Baseline**: All projects ship with pre-configured Security Headers, Content-Security-Policy (CSP), and automated Request ID propagation through the platform proxy.
- **Progressive "Zero-Route" Activation**: Features that are disabled are **physically absent** from the route manifest and consume no runtime resources.
- **Unified Identity Compliance**: Better Auth integration is mandatory but flexible, with text-based User IDs and pre-baked server-side helpers (`getViewer`, `requireAuth`) that work out-of-the-box.
- **"Source of Truth" Documentation**: Automated marker-sync for `ERD.md` and `ARCHITECTURE.md` ensures that documentation is never out-of-sync with implementation.
- **Standardized UI Tokens**: The platform enforces a consistent CSS baseline based on the 0xstack "globals" specification, providing a rock-solid foundation for any branding.

---

## Product Milestones (v1 Cycle)

### Milestone 1 — Core CLI Engine & Config Governance
The foundation of the 0xstack platform is a robust command-line engine that provides deterministic outputs and strict governance over project configuration.

- **Intelligent Command Framework**: A high-performance CLI that handles all platform operations—from bootstrapping to auditing—with built-in error resilience.
- **Config-as-Code (Single Source of Truth)**: Centralized schema-based configuration that defines your architecture, active modules, and environment profiles.
- **Deterministic Pipeline Architecture**: Every action is broken down into auditable, named steps with clear skip/fail logic to ensure predictable results in any environment.
- **Interoperable Tooling Wrappers**: Native, auditable interfaces for essential industry tools, including **shadcn/ui**, **Better Auth**, and **Drizzle**.

---

### Milestone 2 — Production Scaffolding & Tiered Architecture
Generating a feature-complete application skeleton that adheres to the 0xstack standard for security, branding, and performance.

- **Standardized Next.js App Router Skeleton**: A "Flat Layout" architecture that replaces confusing route-group bloat with explicit, search-optimized structure.
- **Unified Security & Governance Proxy**: A central platform proxy (`proxy.ts`) providing request tracing, security headers, and CSP enforcement.
- **Integrated UI & Branding System**: Native **shadcn/ui** integration with pre-configured CSS tokens, theme-management, and accessibility-first components.
- **Fail-Fast Environment System**: A robust environment validation subsystem (`zod`-based) that prevents runtime errors by verifying configuration at startup.
- **Transactional Database Wiring**: Out-of-the-box support for **Supabase Postgres + Drizzle ORM**, providing a high-performance database layer with built-in migrations.
- **Marketing, Legal & App Foundation**: Ready-made templates for Home, About, Terms, and Privacy pages, alongside a secure `/app` shell.

---

### Milestone 3 — Identity & Multi-Tenant Foundations
Establishing the project’s identity layer through built-in support for organizations, permissions, and session governance.

- **Unified Identity Infrastructure (Better Auth)**: A production-ready API for handling complex authentication flows (social, magic-link) with text-based user IDs for maximum database flexibility.
- **Enterprise Multi-Tenancy (Organizations)**: First-class support for Organizations and Memberships, including role-based access control and tenant isolation.
- **Identity-Aware Server Helpers**: Secure, cached server-side routines (`getViewer`, `requireAuth`) for seamless and high-performance session management tracking.
- **Automated Domain Lifecycle**: The CLI manages the initial Auth schema generation and database migration steps, ensuring that identity architecture and data remain in sync.
- **Gated Write Highway**: All database writes are isolated to secure **Server Actions**, preventing unauthenticated, rogue access.

---

### Milestone 4 — Modern Module Ecosystem & On-Demand Activation
The bridge to enterprise maturity, where complex platform modules (Blog, Billing, Storage) are progressively and securely activated on as as-needed basis.

- **Progressive "Zero-Leak" Architecture**: A core platform guarantee where disabled modules ship zero routes, zero runtime handlers, and no top-level imports.
- **The 0xstack Module Lifecycle**: A robust contract (`install / activate / sync`) that ensures complex features are added to your project without clobbering existing code or adding technical debt.
- **Automated Dependency Convergence**: Building with `npx 0xstack baseline` to reconcile project state across code, environment, and dependencies in a single, auditable command.
- **Dynamic Configuration Primitives**: A unified API for accessing platform services, providing a single point of interaction for Storage, Billing, and Identity drivers.

---

### Milestone 5 — Enterprise Content Strategy & Discovery
Deploying a premium, architectural standard for content and search engine dominance through built-in MDX and SEO metadata governance.

- **High-Performance MDX Blog Engine**: A content-as-code pipeline featuring frontmatter management, RSS feed generation, and fully customizable MDX rendering.
- **Unified Metadata Governance**: Centrally managed SEO defaults for root layouts, with granular support for per-post overrides, OpenGraph/Twitter social cards, and Canonical URL strategies.
- **Automated Search Integration**: Site-wide `robots.txt` and `sitemap.xml` that automatically synchronize with your marketing pages and blog content.
- **Structured Data (JSON-LD)**: Pre-baked support for schema.org entities—including Article, WebSite, and Organization—to maximize visibility for search engines and AI agents.
- **Automated Validation**: Built-in "doctor" rules ensure your discovery surfaces follow industry best practices and required configurations.

---

### Milestone 6 — Financial Operations & Scalable Infrastructure
Deploying modern revenue and cloud storage infrastructure with a focus on security, idempotency, and high-performance asset delivery.

- **Integrated Revenue Engine (Dodo Payments)**: Ready-made financial infrastructure including checkouts, customer portals, and enterprise-grade **Webhook Idempotency** (pre-baked into the ledger subsystem).
- **Hardened Cloud Storage Lifecycle (GCS/S3)**: Secure issuance of signed URLs for uploads and downloads, utilizing ownership-aware asset tracking and content-type restrictions.
- **Transactional Governance**: Centralized services for both Storage and Billing that abstract complex provider details while maintaining strict TypeScript safety.
- **Enterprise-Scale Security Hardening**: A comprehensive security subsystem (`lib/security/*`) providing built-in rate-limiting and identity-gated access for all external API surfaces.
- **End-to-End Traceability**: Integration of request-level correlation IDs into the system proxy, ensuring every financial and storage event is auditable.

---

### Milestone 7 — Advanced Generation & Continuous Governance
Delivering the high-velocity "Vibecoding" experience through intelligent domain generation, automated documentation, and self-healing governance systems.

- **Intelligent Domain Generation Engine**: A high-velocity generator that automates the creation of entire features (Schema → Repos → Actions → UI Hooks) while ensuring zero-drift architectural logic.
- **Self-Healing Platform Governance (Doctor)**: A comprehensive audit engine that ensures your project remains compliant with 0xstack standards for security, environment, and boundary isolation.
- **The Living Platform Runbook (Docs Sync)**: Market-based documentation engine that automatically regenerates `PRD.md`, `ERD.md`, and `ARCHITECTURE.md` to reflect the ground-truth of your code.
- **Architectural Harmony (Sync)**: A reconciliation mechanism that ensures platform configuration, dependencies, and route manifests are always in sync.
- **Extensible Command Infrastructure**: Pre-configured hooks for release management (Changesets), CI/CD diagnostics, and future platform upgrades (Codemods).
- **Platform Refinement**: Continuous CLI UX polish, including spinners, clear remediation paths, and idempotent execution flows.

---

## Platform Capability Matrix (v1 Feature Set)

### Core Engine Primitives
- **Autonomous Scaffolding**: Standardized Next.js + shadcn + Auth booting.
- **Architectural Enforcement**: Static import audits and boundary verification.
- **Progressive Feature Activation**: On-demand route and SDK emission.
- **Living Documentation Engine**: Real-time architectural and data-model sync.

### Enterprise Surface Areas
- **Identity & Governance**: Built-in Better Auth + Multi-Tenant Isolation.
- **Financial Operations**: Dodo Payments integration with Webhook idling logic.
- **Global Storage Assets**: Signed-URL lifecycle management for GCS/S3.
- **Deep Content Discovery**: Premium MDX Blog, Global SEO, and sitemap/RSS automation.
- **Hardened Security Foundations**: Integrated CSP, Request Tracing, and API Authorization.

### Continuous Development Experience
- **Intelligent Generators**: Rapid feature domain creation (CRUD and more).
- **Self-Healing Commands**: Centralized `doctor` and `sync` for runtime hygiene.
- **Enterprise UI Hooks**: Pre-configured TanStack query keys and mutation patterns.

---

## The 0xstack Commitment

A "working v1" of 0xstack represents more than just a starter kit; it's a **Standard of Excellence** for the modern web. We prioritize architectural integrity over cosmetic polish, ensuring that your foundation is unbreakable, your security is absolute, and your velocity is maximized through automated governance. 


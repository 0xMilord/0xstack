<p align="center">
  <img src="./assets/0xstack.svg" width="130" alt="0xstack logo">
</p>

<h1 align="center">
  0xstack
</h1>

<p align="center">
  Opinionated starter-system CLI for building and maintaining production-grade Next.js apps with Supabase Postgres + Drizzle.
</p>

<p align="center">
  Generate a project once, then keep it correct over time with <code>baseline</code>, <code>doctor</code>, and <code>sync</code>.
</p>

<div align="center">

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![License][license-image]][license-url] [![PRs Welcome][contribute-image]][contribute-url]

</div>

## Table of contents

- [What is 0xstack?](#what-is-0xstack)
- [Core ideas](#core-ideas)
- [Getting started](#getting-started)
- [CLI commands](#cli-commands)
- [Release process](#release-process)
- [Contributing](#contributing)

## What is 0xstack?

0xstack is a **starter system** (not just a template):

- **Scaffold** a new app via `init`
- **Install + activate** modules via `baseline` (config-driven)
- **Verify** architecture and env via `doctor`
- **Reconcile** your repo + docs over time via `sync`

The generated app targets a consistent architecture for:

- Supabase Postgres (DB)
- Drizzle (schema/repos)
- Better Auth (auth)
- Two entry points:
  - **Internal** server actions (RSC-first app)
  - **External** stable HTTP routes (integrations/clients)

## Core ideas

- **Installed ≠ activated**: modules can exist but stay dormant unless enabled in config.
- **Two highways**:
  - Read: `RSC page → loader → repo → DB`
  - Write: `Client UI → server action → rules → (service) → repo → DB`
- **Operator mindset**: the CLI is designed to run repeatedly and keep projects consistent.

## Getting started

This package is published to **npmjs**, which means it works with **npm / pnpm / yarn / bun**.

### npm

```bash
npx @0xmilord/0xstack init
```

### pnpm

```bash
pnpm dlx @0xmilord/0xstack init
```

### yarn

```bash
yarn dlx @0xmilord/0xstack init
```

### bun

```bash
bunx @0xmilord/0xstack init
```

## CLI commands

### `init`

Scaffold a new app (interactive):

```bash
npx @0xmilord/0xstack init
```

### `baseline`

Idempotent “make it correct” command (deps + schema + migrations + module activation + docs):

```bash
npx @0xmilord/0xstack baseline --profile full
```

### `doctor`

Static checks for env + invariants + boundary rules:

```bash
npx @0xmilord/0xstack doctor --profile full
```

### `sync`

Non-destructive reconciliation (docs + hygiene):

```bash
npx @0xmilord/0xstack sync
```

### `generate <domain>`

Generate a new domain module end-to-end:

```bash
npx @0xmilord/0xstack generate materials --with-api
```

## Release process

See [`RELEASING.md`](RELEASING.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Please read it before opening a PR.

[downloads-image]: https://img.shields.io/npm/dm/%40oxmilord%2F0xstack
[npm-url]: https://www.npmjs.com/package/@0xmilord/0xstack
[npm-image]: https://img.shields.io/npm/v/%40oxmilord%2F0xstack
[license-url]: ./LICENSE
[license-image]: https://img.shields.io/npm/l/%40oxmilord%2F0xstack
[contribute-url]: ./CONTRIBUTING.md
[contribute-image]: https://img.shields.io/badge/PRs-welcome-blue.svg


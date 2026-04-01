<p align="center">
  <strong>0xstack</strong> (npm: <code>0xstack</code>)
</p>

<h1 align="center">
  0xstack CLI
</h1>

<p align="center">
  Opinionated starter-system CLI for building and maintaining production-grade Next.js apps with Postgres + Drizzle + Better Auth.
</p>

<div align="center">

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![License][license-image]][license-url]

</div>

## Quickstart

```bash
npx 0xstack init
cd my-app
npx 0xstack baseline --profile full
npx 0xstack doctor --profile full
pnpm dev
```

## Commands

- `init`: scaffold a new app
- `baseline`: idempotent install/activate modules + migrations + docs
- `doctor`: validate env, boundaries, and required files
- `sync`: reconcile repo with config (plan by default)
- `docs sync`: regenerate marker-backed docs
- `generate <domain>`: add a domain end-to-end

## Release notes

See [`CHANGELOG.md`](./CHANGELOG.md).

[downloads-image]: https://img.shields.io/npm/dm/0xstack
[npm-url]: https://www.npmjs.com/package/0xstack
[npm-image]: https://img.shields.io/npm/v/0xstack
[license-url]: ./LICENSE
[license-image]: https://img.shields.io/npm/l/0xstack


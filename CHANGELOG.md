# Changelog

All notable changes to VAST are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changes prior to 1.2.0 are documented in the git history.

## [1.2.1] — 2026-04-22

### Security

- Bumped `vite` from 7.2.2 to 7.3.2, closing three advisories including
  `GHSA-v2wj-q39q-566r` (server.fs.deny bypass via queries) and
  `GHSA-p9ff-h696-f583` (arbitrary file read via dev server WebSocket).
  Both only pose real-world risk when the Vite dev server is exposed to
  an untrusted network (ngrok tunnels, remote teammates, etc.), but are
  still worth patching.
- Bumped `vite-plugin-shopify` from 4.0.2 to 4.1.2, which pulls in
  `@shopify/cli-kit@3.93.2` (up from 3.86.1). This cascaded auto-patches
  for `ajv`, `simple-git`, `protobufjs`, `minimatch`, `brace-expansion`,
  and most `liquidjs` advisories without requiring any overrides.
- Ran `npm update` within declared semver ranges to pull forward `rollup`
  (≥ 4.59.0, closing `GHSA-mw96-cpmx-2vgc`), `picomatch`, and related
  transitives that were pinned to older versions in the lockfile.

### Known remaining advisories

Two unpatched transitives persist inside `@shopify/cli-kit`: `lodash` (1
high + 1 medium, upstream cli-kit still pins 4.17.23) and `liquidjs`
(4 high, cli-kit pins 10.25.0 but the newer advisories require 10.25.3+).
Both are **dev-only** in the Shopify-theme context — no npm package ships
to shoppers, since browser JS is the Vite-compiled output in `assets/`.
Realistic impact for theme development is near-zero (you control your own
Liquid templates and input to lodash). Deferring fixes until the next
`@shopify/cli-kit` releases rather than introducing `overrides` that
could break cli-kit's internal assumptions.

## [1.2.0] — 2026-04-21

### Changed

- Default `npm run dev` no longer uses `--theme-editor-sync` (matches Shopify
  CLI's own default). Run `npm run dev:sync` for round-trip behavior, or
  `shopify theme pull` to capture theme-editor changes manually. The old
  default silently round-tripped theme-editor experiments into the local
  working tree, which surprised CLI-push developers who treat their repo as
  the source of truth.
- Setup wizard now asks about deployment strategy (Shopify CLI push /
  GitHub integration / Not sure yet) and configures `.gitignore` and the
  recommended dev script to match. Mutations use a marker-delimited managed
  block (`# >>> VAST setup: gitignore block <<<` / `# >>> end VAST setup <<<`)
  so reruns are idempotent — you can switch deployment strategies at any time
  by rerunning the wizard.

### Added

- `npm run dev:sync` and `npm run dev:vite-server:sync` script variants that
  keep `--theme-editor-sync` enabled for users who want theme-editor changes
  to flow back into their working tree (typical for GitHub-integration
  deployments).
- README "Dev Workflow" section explaining the two scripts, what theme-editor
  edits actually modify (`templates/*.json`, `config/settings_data.json`), and
  what lives outside the theme (metafields, metaobjects, products, blog posts,
  customers).

### Dependencies

- Bumped `@anchovie/schematic` from 2.2.1 to 2.2.6.
